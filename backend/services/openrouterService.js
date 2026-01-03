const axios = require('axios');
const crypto = require('crypto');

class OpenRouterService {
  constructor() {
    // Text generation (Groq)
    this.groqApiKey = process.env.GROQ_API_KEY;
    this.groqTextModel = 'qwen/qwen3-32b';
    this.groqBaseURL = 'https://api.groq.com/openai/v1';

    // Optional fallback (OpenRouter)
    this.openRouterApiKey = process.env.OPENROUTER_API_KEY;
    this.openRouterTextModel = 'xiaomi/mimo-v2-flash:free';
    this.openRouterBaseURL = 'https://openrouter.ai/api/v1';

    // Image generation currently uses Pollinations.ai; keep fields for backward compatibility.
    this.imageModel = 'bytedance-seed/seedream-4.5';

    // Pollinations (paid/free) image API
    this.pollinationsApiKey = process.env.POLLINATIONS_API_KEY;
    this.pollinationsBaseURL = 'https://gen.pollinations.ai';
    this.pollinationsImageModel = 'turbo';
    this.imageStyles = {
      cinematic: 'cinematic, dramatic lighting, high contrast, detailed',
      artistic: 'artistic, painterly, beautiful colors, expressive',
      realistic: 'photorealistic, highly detailed, natural lighting',
      fantasy: 'fantasy art, magical, ethereal, vibrant colors',
      dark: 'dark atmosphere, moody, noir style, shadows',
      anime: 'anime style, cel-shaded, dynamic, colorful'
    };
  }

  async chatCompletions({ provider, baseURL, apiKey, model, messages, temperature, max_tokens }) {
    const response = await axios.post(
      `${baseURL}/chat/completions`,
      {
        model,
        messages,
        ...(typeof temperature === 'number' ? { temperature } : null),
        ...(typeof max_tokens === 'number' ? { max_tokens } : null),
      },
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(provider === 'openrouter'
            ? {
                'HTTP-Referer': 'http://localhost:3000',
                'X-Title': 'Interactive Story Generator'
              }
            : null)
        }
      }
    );

    return response.data;
  }

  async generateTextCompletion({ prompt, temperature = 0.9, maxTokens = 2048 }) {
    const messages = [{ role: 'user', content: prompt }];

    if (this.groqApiKey) {
      return this.chatCompletions({
        provider: 'groq',
        baseURL: this.groqBaseURL,
        apiKey: this.groqApiKey,
        model: this.groqTextModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      });
    }

    if (this.openRouterApiKey) {
      return this.chatCompletions({
        provider: 'openrouter',
        baseURL: this.openRouterBaseURL,
        apiKey: this.openRouterApiKey,
        model: this.openRouterTextModel,
        messages,
        temperature,
        max_tokens: maxTokens,
      });
    }

    return null;
  }

  isHttpUrl(value) {
    return typeof value === 'string' && (value.startsWith('http://') || value.startsWith('https://'));
  }

  isDataImageUrl(value) {
    return typeof value === 'string' && value.startsWith('data:image');
  }

  guessMimeFromBase64(base64) {
    if (typeof base64 !== 'string') return 'image/png';
    if (base64.startsWith('/9j/')) return 'image/jpeg';
    if (base64.startsWith('iVBORw0')) return 'image/png';
    if (base64.startsWith('R0lGOD')) return 'image/gif';
    if (base64.startsWith('UklGR')) return 'image/webp';
    if (base64.startsWith('Qk')) return 'image/bmp';
    return 'image/png';
  }

  looksLikeBase64(data) {
    if (typeof data !== 'string') return false;
    const normalized = data.replace(/\s+/g, '');
    // Too short is almost certainly not an image payload
    if (normalized.length < 200) return false;
    // Base64 alphabet check (allow padding)
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)) return false;
    // Base64 length is typically multiple of 4
    if (normalized.length % 4 !== 0) return false;
    return true;
  }

  toDataImageUrl(possibleBase64, mimeType) {
    if (this.isDataImageUrl(possibleBase64)) return possibleBase64;
    if (typeof possibleBase64 !== 'string') return null;
    const trimmed = possibleBase64.trim();
    if (!trimmed) return null;
    // Heuristic: if it looks like a URL, don't wrap it.
    if (this.isHttpUrl(trimmed)) return trimmed;

    if (!this.looksLikeBase64(trimmed)) return null;

    const safeMime = typeof mimeType === 'string' && mimeType.startsWith('image/')
      ? mimeType
      : this.guessMimeFromBase64(trimmed);
    return `data:${safeMime};base64,${trimmed}`;
  }

  extractImageFromString(text) {
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();

    if (this.isHttpUrl(trimmed) || this.isDataImageUrl(trimmed)) {
      return trimmed;
    }

    // Match data URLs embedded in markdown or plain text
    const dataUrlMatch = trimmed.match(/data:image\/[a-zA-Z0-9+.-]+;base64,[A-Za-z0-9+/=]+/);
    if (dataUrlMatch) return dataUrlMatch[0];

    // Extract http(s) URLs
    const urlMatch = trimmed.match(/https?:\/\/[^\s)\]]+/);
    if (urlMatch) return urlMatch[0];

    // If response is JSON-encoded, try parsing
    if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
      try {
        const parsed = JSON.parse(trimmed);
        return this.extractImageFromAny(parsed);
      } catch {
        // ignore
      }
    }

    return null;
  }

  extractImageFromAny(value, depth = 0) {
    if (depth > 8) return null;
    if (!value) return null;

    if (typeof value === 'string') {
      return this.extractImageFromString(value) || this.toDataImageUrl(value);
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const found = this.extractImageFromAny(item, depth + 1);
        if (found) return found;
      }
      return null;
    }

    if (typeof value === 'object') {
      // Common OpenAI/OpenRouter multimodal shapes
      // - { type: 'image_url', image_url: { url } }
      // - { type: 'image', image: { data, mime_type } }
      // - { url }
      if (this.isHttpUrl(value.url)) return value.url;
      if (this.isDataImageUrl(value.url)) return value.url;

      if (value.image_url) {
        if (this.isHttpUrl(value.image_url)) return value.image_url;
        if (this.isDataImageUrl(value.image_url)) return value.image_url;
        if (typeof value.image_url === 'object') {
          const candidate = value.image_url.url;
          if (this.isHttpUrl(candidate) || this.isDataImageUrl(candidate)) return candidate;
        }
      }

      if (value.image && typeof value.image === 'object') {
        const data = value.image.data || value.image.b64_json || value.image.base64;
        const mimeType = value.image.mime_type || value.image.mimeType;
        const asDataUrl = this.toDataImageUrl(data, mimeType);
        if (asDataUrl) return asDataUrl;
      }

      const directBase64 = value.b64_json || value.base64 || value.data;
      const directMime = value.mime_type || value.mimeType;
      const asDataUrl = this.toDataImageUrl(directBase64, directMime);
      if (asDataUrl && this.isDataImageUrl(asDataUrl)) return asDataUrl;
      if (this.isHttpUrl(directBase64)) return directBase64;

      // Walk the object for any nested image fields
      for (const key of Object.keys(value)) {
        const found = this.extractImageFromAny(value[key], depth + 1);
        if (found) return found;
      }
    }

    return null;
  }

  // Функція для видалення зірочок та інших декоративних символів з тексту
  cleanText(text) {
    if (!text || typeof text !== 'string') return text;
    // Прибираємо зірочки, подвійні зірочки та інші markdown символи
    return text
      .replace(/\*\*/g, '')  // Видаляє **
      .replace(/\*/g, '')    // Видаляє *
      .replace(/_{2,}/g, '') // Видаляє __ та більше
      .replace(/_/g, '')     // Видаляє _
      .trim();
  }

  async generateStoryStart(genre, setting, mainCharacter) {
    const prompt = `Ти - майстер розповідей. Створи початок інтерактивної історії українською мовою.
    
Жанр: ${genre}
Сеттінг: ${setting}
Головний персонаж: ${mainCharacter}

Створи захоплюючий початок історії (3-4 абзаци), який занурює читача у світ. Історія має бути нелінійною та дозволяти різні варіанти розвитку подій.

Потім запропонуй 3 різні варіанти дій для головного персонажа. Кожен варіант має бути цікавим і вести до різних наслідків.

ВАЖЛИВО: Не використовуй зірочки (*), підкреслення (_) чи інші markdown символи у тексті. Пиши чистий текст без форматування.

Формат відповіді:
ІСТОРІЯ: [текст історії]
ВИБІР_1: [перший варіант]
ВИБІР_2: [другий варіант]
ВИБІР_3: [третій варіант]`;

    // If no AI key is provided, return a mocked response for local development
    if (!this.groqApiKey && !this.openRouterApiKey) {
      console.warn('No AI key set (GROQ_API_KEY / OPENROUTER_API_KEY) — returning mocked story for development');
      return {
        content: `У ${setting} народжена нова легенда. ${mainCharacter} стоїть на порозі пригод, коли несподівана подія змінює життя героя.`,
        choices: [
          'Піти в найближче місто, щоб знайти підказки',
          'Дослідити таємничий ліс поруч',
          'Повернутися додому і підготуватися до труднощів'
        ]
      };
    }
    try {
      const data = await this.generateTextCompletion({ prompt, temperature: 0.9, maxTokens: 2048 });
      if (!data) throw new Error('No AI provider configured');
      return this.parseStoryResponse(data);
    } catch (error) {
      console.error('Помилка генерації історії:', error.response?.data || error.message);
      // If quota exceeded or service error, fallback to mock to avoid blocking users
      const status = error.response?.status;
      if (status === 429 || status === 503) {
        console.warn('Quota exceeded or rate-limited — returning fallback mock response');
        return {
          content: `У ${setting} ${mainCharacter} опиняється перед складним вибором після дивної події.`,
          choices: ['Піти вперед', 'Оберегтися', 'Набратися сил']
        };
      }
      throw new Error('Не вдалося згенерувати історію');
    }
  }

  async continueStory(previousContext, userChoice, genre, setting, mainCharacter) {
    const prompt = `Ти продовжуєш інтерактивну історію українською мовою.

Жанр: ${genre}
Сеттінг: ${setting}
Головний персонаж: ${mainCharacter}

Попередній контекст історії:
${previousContext}

Користувач обрав: "${userChoice}"

Продовж історію (2-3 абзаци) на основі вибору користувача. Розвивай сюжет логічно та захоплююче.

Потім запропонуй 3 нові варіанти дій, які випливають із поточної ситуації.

ВАЖЛИВО: Не використовуй зірочки (*), підкреслення (_) чи інші markdown символи у тексті. Пиши чистий текст без форматування.

Формат відповіді:
ІСТОРІЯ: [текст продовження]
ВИБІР_1: [перший варіант]
ВИБІР_2: [другий варіант]
ВИБІР_3: [третій варіант]`;

    // If no AI key is provided, return a mocked continuation for development
    if (!this.groqApiKey && !this.openRouterApiKey) {
      console.warn('No AI key set (GROQ_API_KEY / OPENROUTER_API_KEY) — returning mocked continuation for development');
      return {
        content: `Після вибору '${userChoice}' ${mainCharacter} стикається з новим викликом, який змінює ситуацію.`,
        choices: [
          'Звернутися по допомогу до старого друга',
          'Виконати ризиковану операцію наодинці',
          'Відкласти рішення і спостерігати'
        ]
      };
    }
    try {
      const data = await this.generateTextCompletion({ prompt, temperature: 0.9, maxTokens: 2048 });
      if (!data) throw new Error('No AI provider configured');
      return this.parseStoryResponse(data);
    } catch (error) {
      console.error('Помилка продовження історії:', error.response?.data || error.message);
      const status = error.response?.status;
      if (status === 429 || status === 503) {
        console.warn('Quota exceeded or rate-limited — returning fallback continuation');
        return {
          content: `Після вибору "${userChoice}" історія розгортається несподівано: герої стикаються з новою загрозою.`,
          choices: ['Звернутися по допомогу', 'Випробувати силу', 'Проаналізувати ситуацію']
        };
      }
      throw new Error('Не вдалося продовжити історію');
    }
  }

  async generateImage(sceneDescription, genre, setting, style = 'cinematic', quality = 'standard') {
    // Визначаємо стиль зображення
    const styleModifier = this.imageStyles[style] || this.imageStyles.cinematic;
    
    // Мапінг жанрів на візуальні характеристики
    const genreVisuals = {
      'фентезі': 'magical fantasy world, mystical atmosphere',
      'фантастика': 'sci-fi environment, futuristic technology',
      'детектив': 'mysterious atmosphere, noir lighting',
      'жахи': 'dark and eerie, horror atmosphere',
      'пригоди': 'adventurous scene, dynamic action',
      'романтика': 'romantic setting, warm lighting'
    };

    const genreVisual = genreVisuals[genre] || 'atmospheric scene';

    // Додаємо стилістику для менш реалістичних, більш художніх зображень
    const artisticStyle = 'stylized illustration, digital art, concept art style, artistic interpretation, painterly, non-photorealistic';
    
    const basePrompt = `${sceneDescription}. ${setting}. ${genreVisual}. ${artisticStyle}. ${styleModifier}. Ultra high quality, extremely detailed, masterpiece, 8K resolution, professional digital illustration, sharp focus, crisp details, premium quality, award-winning art.`;
    const prompt = String(basePrompt).replace(/\s+/g, ' ').trim().slice(0, 350);

    // Use Pollinations API gateway (supports model=zimage). We'll proxy the image server-side so the client
    // never needs the API key.
    const encodedPrompt = encodeURIComponent(prompt);

    // Map app quality -> pollinations quality (збільшуємо якість за замовчуванням)
    const qualityMap = {
      standard: 'hd',
      low: 'high',
      medium: 'hd',
      high: 'hd',
      hd: 'hd'
    };
    const q = qualityMap[quality] || 'hd';

    // seed=-1 => random each time
    return `${this.pollinationsBaseURL}/image/${encodedPrompt}?model=${this.pollinationsImageModel}&seed=-1&quality=${q}&nofeed=true&nologo=true`;
  }

  async generateMultipleImages(sceneDescription, genre, setting, styles = ['cinematic', 'artistic'], count = 2) {
    // Генеруємо кілька зображень у різних стилях
    const promises = styles.slice(0, count).map(style => 
      this.generateImage(sceneDescription, genre, setting, style)
    );

    try {
      const images = await Promise.all(promises);
      return images.filter(img => img !== null); // Прибираємо null результати
    } catch (error) {
      console.error('Помилка генерації множинних зображень:', error);
      return [];
    }
  }

  parseStoryResponse(data) {
    try {
      // Groq/OpenRouter return standard OpenAI-compatible format
      const message = data?.choices?.[0]?.message;
      const text = message?.content;
      
      if (!text) {
        console.warn('parseStoryResponse: no text found in response', { data });
        throw new Error('No content in response');
      }
      
      const storyMatch = text.match(/ІСТОРІЯ:\s*([\s\S]*?)(?=ВИБІР_1:|$)/);
      const choice1Match = text.match(/ВИБІР_1:\s*(.*?)(?=\n|ВИБІР_2:|$)/);
      const choice2Match = text.match(/ВИБІР_2:\s*(.*?)(?=\n|ВИБІР_3:|$)/);
      const choice3Match = text.match(/ВИБІР_3:\s*(.*?)(?=\n|$)/);

      // Очищаємо текст від зірочок та інших markdown символів
      const cleanedContent = this.cleanText(storyMatch ? storyMatch[1].trim() : text);
      const cleanedChoice1 = this.cleanText(choice1Match ? choice1Match[1].trim() : 'Продовжити дослідження');
      const cleanedChoice2 = this.cleanText(choice2Match ? choice2Match[1].trim() : 'Повернутися назад');
      const cleanedChoice3 = this.cleanText(choice3Match ? choice3Match[1].trim() : 'Зачекати і подивитися');

      return {
        content: cleanedContent,
        choices: [
          cleanedChoice1,
          cleanedChoice2,
          cleanedChoice3
        ]
      };
    } catch (error) {
      console.error('Помилка парсингу відповіді:', error);
      throw new Error('Не вдалося обробити відповідь AI');
    }
  }
}

module.exports = new OpenRouterService();
