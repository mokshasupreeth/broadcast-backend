export const translateText = async (text, targetLanguage) => {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': 'YOUR_ANTHROPIC_API_KEY',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{
          role: 'user',
          content: `Translate this text to ${targetLanguage}. Return ONLY the translated text, nothing else:\n\n${text}`
        }],
      })
    });
    const data = await response.json();
    return data.content?.[0]?.text || text;
  } catch (e) {
    return text;
  }
};

export const LANGUAGES = [
  { code: 'Telugu', label: 'తెలుగు' },
  { code: 'Hindi', label: 'हिंदी' },
  { code: 'Tamil', label: 'தமிழ்' },
  { code: 'Kannada', label: 'ಕನ್ನಡ' },
  { code: 'Malayalam', label: 'മലയാളം' },
  { code: 'English', label: 'English' },
  { code: 'Spanish', label: 'Español' },
  { code: 'French', label: 'Français' },
  { code: 'Arabic', label: 'العربية' },
  { code: 'Japanese', label: '日本語' },
];