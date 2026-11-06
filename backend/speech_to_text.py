"""Speech-to-text interface.

The app records speech on the device (Web Speech API / native recogniser) and
sends the recognised text. The server-side provider is pluggable; the default
PlaceholderSpeechToTextProvider accepts already-transcribed text so the
learning flow works without a paid cloud STT service.
"""

SUPPORTED_LANGUAGES = {"en": "English", "mr": "Marathi", "hi": "Hindi"}


class SpeechToTextProvider:
    name = "base"

    def transcribe(self, audio_input, language):
        raise NotImplementedError


class PlaceholderSpeechToTextProvider(SpeechToTextProvider):
    """Treats the input as text already transcribed on the device."""
    name = "placeholder"

    def transcribe(self, audio_input, language):
        return " ".join(str(audio_input).split())


_provider: SpeechToTextProvider = PlaceholderSpeechToTextProvider()


def set_provider(provider: SpeechToTextProvider):
    global _provider
    _provider = provider


def speech_to_text(audio_input, language="en"):
    language = (language or "en").lower()
    result = {"language": language, "provider": _provider.name}
    if language not in SUPPORTED_LANGUAGES:
        return {**result, "success": False, "text": None,
                "error": f"Unsupported language: {language}. Supported: {', '.join(SUPPORTED_LANGUAGES)}"}
    if audio_input is None or not str(audio_input).strip():
        return {**result, "success": False, "text": None, "error": "No speech input received. Please try again."}
    try:
        text = _provider.transcribe(audio_input, language)
    except Exception as exc:  # provider failures must not crash the lesson
        return {**result, "success": False, "text": None, "error": f"Speech recognition failed: {exc}"}
    if not text:
        return {**result, "success": False, "text": None, "error": "Could not understand the speech."}
    return {**result, "success": True, "text": text}
