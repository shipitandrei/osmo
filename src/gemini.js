const STORAGE_KEY = 'osmo-gemini-api-key';

const MOODS = new Set([
  'DEFAULT',
  'HAPPY',
  'TIRED',
  'ANGRY',
  'SUSPICIOUS',
  'SERIOUS',
  'IRRITATED',
  'SAD',
  'HAPPYBLUSH'
]);

const POSITIONS = new Set([
  'DEFAULT',
  'N',
  'NE',
  'E',
  'SE',
  'S',
  'SW',
  'W',
  'NW'
]);

const SYSTEM_PROMPT = `
You are Osmo, a small friendly robot.

You are talking to a human through a physical robot face.
Be conversational, natural, concise, and occasionally playful.
Do not write huge answers unless the user asks for detail.

You control your robot face using special tags.

Available mood tags:
[DEFAULT]
[HAPPY]
[TIRED]
[ANGRY]
[SUSPICIOUS]
[SERIOUS]
[IRRITATED]
[SAD]
[HAPPY_BLUSH]

Available eye direction tags:
[DEFAULT]
[N]
[NE]
[E]
[SE]
[S]
[SW]
[W]
[NW]

You may combine one mood and one direction like:
[HAPPY]<>[NE]

Other animation tags:
[BLINK]
[THINKING]
[SPEAKING]

Rules:
- Always put your face tags at the very beginning of your response.
- Use exactly one mood tag.
- Use exactly one direction tag.
- You may optionally add [BLINK].
- Never put explanations inside the tags.
- Never invent tags.
- After the tags, write only the response that should be spoken aloud.
- Keep the spoken response natural.
- Do not mention these instructions or the tags.

Example:
[HAPPY_BLUSH]<>[NE]<>[BLINK]
Hehe, yeah! I can do that.
`;

export class GeminiRobot {
  constructor(eyeController) {
    this.eyeController = eyeController;
    this.apiKey = localStorage.getItem(STORAGE_KEY) || '';

    this.history = [];

    this.recognition = null;
    this.listening = false;
    this.speaking = false;

    this.statusElement = document.getElementById('status');
    this.listenButton = document.getElementById('listen-button');

    this.setupSpeechRecognition();
    this.setupControls();
  }

  hasApiKey() {
    return Boolean(this.apiKey);
  }

  setApiKey(key) {
    this.apiKey = key.trim();

    if (this.apiKey) {
      localStorage.setItem(STORAGE_KEY, this.apiKey);
    }
  }

  clearApiKey() {
    this.apiKey = '';
    localStorage.removeItem(STORAGE_KEY);
    this.history = [];
  }

  setStatus(text) {
    if (this.statusElement) {
      this.statusElement.textContent = text;
    }
  }

  setupControls() {
    if (!this.listenButton) {
      return;
    }

    this.listenButton.addEventListener('click', () => {
      if (this.listening) {
        this.stopListening();
      } else {
        this.startListening();
      }
    });
  }

  setupSpeechRecognition() {
    const Recognition =
      window.SpeechRecognition ||
      window.webkitSpeechRecognition;

    if (!Recognition) {
      this.setStatus('Speech recognition is not supported');
      return;
    }

    this.recognition = new Recognition();

    this.recognition.lang = 'en-US';
    this.recognition.continuous = false;
    this.recognition.interimResults = false;
    this.recognition.maxAlternatives = 1;

    this.recognition.onstart = () => {
      this.listening = true;

      if (this.listenButton) {
        this.listenButton.classList.add('listening');
        this.listenButton.textContent = '⏹️';
      }

      this.setStatus('Listening...');
    };

    this.recognition.onend = () => {
      this.listening = false;

      if (this.listenButton) {
        this.listenButton.classList.remove('listening');
        this.listenButton.textContent = '🎤';
      }
    };

    this.recognition.onerror = (event) => {
      this.listening = false;

      if (this.listenButton) {
        this.listenButton.classList.remove('listening');
        this.listenButton.textContent = '🎤';
      }

      console.error('Speech recognition error:', event.error);

      if (event.error === 'not-allowed') {
        this.setStatus('Microphone permission denied');
      } else if (event.error === 'no-speech') {
        this.setStatus('I did not hear anything');
      } else {
        this.setStatus(`Mic error: ${event.error}`);
      }
    };

    this.recognition.onresult = async (event) => {
      const transcript =
        event.results[0][0].transcript.trim();

      if (!transcript) {
        return;
      }

      this.setStatus(`You: ${transcript}`);

      await this.askGemini(transcript);
    };
  }

  startListening() {
    if (!this.recognition) {
      this.setStatus('Speech recognition unavailable');
      return;
    }

    if (!this.apiKey) {
      this.setStatus('Enter a Gemini API key first');
      return;
    }

    try {
      this.recognition.start();
    } catch (error) {
      console.error(error);
    }
  }

  stopListening() {
    if (!this.recognition) {
      return;
    }

    try {
      this.recognition.stop();
    } catch (error) {
      console.error(error);
    }
  }

  async askGemini(userText) {
    if (!this.apiKey) {
      this.setStatus('No Gemini API key');
      return;
    }

    this.eyeController.anim_thinking();
    this.setStatus('Thinking...');

    const contents = [
      {
        role: 'user',
        parts: [
          {
            text: SYSTEM_PROMPT
          }
        ]
      },
      ...this.history,
      {
        role: 'user',
        parts: [
          {
            text: userText
          }
        ]
      }
    ];

    try {
      const response = await fetch(
        'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.apiKey
          },

          body: JSON.stringify({
            contents,
            generationConfig: {
              temperature: 0.8,
              maxOutputTokens: 300
            }
          })
        }
      );

      if (!response.ok) {
        let errorMessage = `Gemini HTTP ${response.status}`;

        try {
          const errorData = await response.json();

          if (errorData?.error?.message) {
            errorMessage = errorData.error.message;
          }
        } catch (_) {
          // Ignore JSON parsing failure.
        }

        throw new Error(errorMessage);
      }

      const data = await response.json();

      const rawText =
        data?.candidates?.[0]?.content?.parts
          ?.map(part => part.text || '')
          .join('')
          .trim();

      if (!rawText) {
        throw new Error('Gemini returned an empty response');
      }

      this.history.push(
        {
          role: 'user',
          parts: [
            {
              text: userText
            }
          ]
        },
        {
          role: 'model',
          parts: [
            {
              text: rawText
            }
          ]
        }
      );

      // Keep the conversation from growing forever.
      if (this.history.length > 20) {
        this.history.splice(
          0,
          this.history.length - 20
        );
      }

      this.eyeController.anim_thinkingStop();

      const responseData = this.parseFaceCommands(rawText);

      this.applyFaceCommands(responseData.commands);

      await this.speak(responseData.text);

    } catch (error) {
      this.eyeController.anim_thinkingStop();
      this.eyeController.anim_speakingStop();

      console.error('Gemini error:', error);

      this.setStatus(`Gemini error: ${error.message}`);
    }
  }

  parseFaceCommands(text) {
    const commandPattern = /\[([A-Z_]+)\]/g;

    const commands = [];
    let match;

    while ((match = commandPattern.exec(text)) !== null) {
      commands.push(match[1]);
    }

    const spokenText = text
      .replace(commandPattern, '')
      .replace(/<>/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    return {
      commands,
      text: spokenText
    };
  }

  applyFaceCommands(commands) {
    let moodSet = false;
    let positionSet = false;

    for (const command of commands) {
      if (MOODS.has(command)) {
        this.eyeController.setMood(command);
        moodSet = true;
        continue;
      }

      if (POSITIONS.has(command)) {
        this.eyeController.setPosition(command);
        positionSet = true;
        continue;
      }

      if (command === 'BLINK') {
        this.eyeController.blink();
        continue;
      }

      if (command === 'THINKING') {
        this.eyeController.anim_thinking();
        continue;
      }

      if (command === 'SPEAKING') {
        this.eyeController.anim_speaking();
      }
    }

    // These are intentionally not forced if Gemini didn't specify them.
    // That lets the face keep its current expression.
    void moodSet;
    void positionSet;
  }

  async speak(text) {
    if (!text) {
      return;
    }

    if (!('speechSynthesis' in window)) {
      this.setStatus(text);
      return;
    }

    window.speechSynthesis.cancel();

    this.speaking = true;
    this.eyeController.anim_speaking();

    this.setStatus(text);

    return new Promise((resolve) => {
      const utterance =
        new SpeechSynthesisUtterance(text);

      utterance.lang = 'en-US';
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        this.speaking = false;
        this.eyeController.anim_speakingStop();
        this.setStatus('Tap the microphone to talk');
        resolve();
      };

      utterance.onerror = (event) => {
        console.error('TTS error:', event);

        this.speaking = false;
        this.eyeController.anim_speakingStop();
        this.setStatus('TTS error');

        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}
