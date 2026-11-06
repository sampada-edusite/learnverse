"""SMS delivery for one-time passwords.

Configure with environment variables:
  SMS_PROVIDER=console   (default) print the message to the server log
  SMS_PROVIDER=twilio    TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
"""
import base64
import logging
import os
import urllib.parse
import urllib.request

log = logging.getLogger("learnverse.sms")


class SmsError(Exception):
    pass


def provider_name():
    return os.environ.get("SMS_PROVIDER", "console").lower()


def is_real_provider():
    return provider_name() != "console"


def send_sms(mobile_10_digit: str, message: str):
    provider = provider_name()
    if provider == "console":
        log.warning("[SMS console] to +91%s: %s", mobile_10_digit, message)
        print(f"[SMS console] to +91{mobile_10_digit}: {message}", flush=True)
        return
    if provider == "twilio":
        sid = os.environ.get("TWILIO_ACCOUNT_SID")
        token = os.environ.get("TWILIO_AUTH_TOKEN")
        sender = os.environ.get("TWILIO_FROM_NUMBER")
        if not (sid and token and sender):
            raise SmsError("Twilio is not fully configured.")
        data = urllib.parse.urlencode({"To": f"+91{mobile_10_digit}", "From": sender, "Body": message}).encode()
        req = urllib.request.Request(f"https://api.twilio.com/2010-04-01/Accounts/{sid}/Messages.json", data=data)
        req.add_header("Authorization", "Basic " + base64.b64encode(f"{sid}:{token}".encode()).decode())
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                if resp.status >= 300:
                    raise SmsError(f"Twilio returned HTTP {resp.status}")
        except OSError as exc:
            raise SmsError(f"Could not send SMS: {exc}") from exc
        return
    raise SmsError(f"Unknown SMS_PROVIDER '{provider}'.")
