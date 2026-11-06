import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Text, View } from 'react-native';
import { KeyRound, Phone, School, UserRound } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { AppBar, Banner, Button, Card, FadeIn, Screen, Tabs, TextField, Type } from '../../ui';
import { Teacher, TeacherAuthApi, errorMessage } from '../../config/platformApi';

interface Props {
  onBack: () => void;
  onAuthenticated: (token: string, teacher: Teacher) => void;
  onOpenSettings?: () => void;
}

export const TeacherAuthScreen: React.FC<Props> = ({ onBack, onAuthenticated, onOpenSettings }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [step, setStep] = useState<'details' | 'otp'>('details');
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [school, setSchool] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [info, setInfo] = useState<{ masked: string; devOtp?: string; devNote?: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const validate = () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 2 || /\d/.test(n)) e.name = 'Enter your full name.';
    if (!/^[6-9]\d{9}$/.test(mobile)) e.mobile = 'Enter a valid 10-digit mobile number.';
    setErrors(e);
    return !Object.keys(e).length;
  };

  const requestOtp = async () => {
    setServerError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const r = await TeacherAuthApi.requestOtp({ name: name.trim(), mobile, purpose: mode, school: school.trim() || undefined });
      setInfo({ masked: r.mobile_masked, devOtp: r.dev_otp, devNote: r.dev_note });
      setStep('otp');
      setCode('');
      setResendIn(30);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setServerError('');
    if (!/^\d{6}$/.test(code)) {
      setErrors({ code: 'Enter the 6-digit code.' });
      return;
    }
    setErrors({});
    setBusy(true);
    try {
      const r = await TeacherAuthApi.verifyOtp({ mobile, purpose: mode, code });
      onAuthenticated(r.token, r.teacher);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<AppBar title="👩‍🏫 Teacher" subtitle="Manage your class, homework, quizzes and progress" onBack={onBack} />}>
        <FadeIn>
          <View style={{ width: '100%', maxWidth: 520, alignSelf: 'center' }}>
            <Card style={{ gap: 16 }}>
              {step === 'details' ? (
                <>
                  <Tabs value={mode} onChange={(k) => { setMode(k as any); setServerError(''); setErrors({}); }}
                    tabs={[{ key: 'login', label: 'Log in' }, { key: 'register', label: 'Create account' }]} />
                  <Text style={Type.body}>
                    {mode === 'login' ? 'Enter the name and mobile number you registered with. We will send a one-time code.'
                      : 'Create your teacher account. We will verify your mobile number with a one-time code.'}
                  </Text>
                  <TextField label="Full name" value={name} onChangeText={setName} placeholder="e.g. Sunita Patil" error={errors.name}
                    icon={<UserRound size={18} color={Colors.textLight} />} maxLength={60} />
                  <TextField label="Mobile number" value={mobile} onChangeText={(t) => setMobile(t.replace(/\D/g, ''))}
                    placeholder="98765 43210" keyboardType="phone-pad" maxLength={10} error={errors.mobile}
                    icon={<Phone size={18} color={Colors.textLight} />} />
                  {mode === 'register' ? (
                    <TextField label="School (optional)" value={school} onChangeText={setSchool} placeholder="e.g. ZP Primary School, Pune"
                      icon={<School size={18} color={Colors.textLight} />} maxLength={120} />
                  ) : null}
                  {serverError ? <Banner tone="danger" text={serverError} /> : null}
                  <Button title="Send OTP" size="lg" full loading={busy} onPress={requestOtp} />
                </>
              ) : (
                <>
                  <Text style={Type.h2}>Enter verification code</Text>
                  <Text style={Type.body}>We sent a 6-digit code to {info?.masked}. It is valid for 5 minutes.</Text>
                  {info?.devOtp ? <Banner tone="info" text={`${info.devNote} Code: ${info.devOtp}`} /> : null}
                  <TextField label="One-time code" value={code} onChangeText={(t) => setCode(t.replace(/\D/g, ''))} placeholder="••••••"
                    keyboardType="number-pad" maxLength={6} error={errors.code} autoFocus onSubmitEditing={verify}
                    icon={<KeyRound size={18} color={Colors.textLight} />} style={{ letterSpacing: 6, fontSize: 22 }} />
                  {serverError ? <Banner tone="danger" text={serverError} /> : null}
                  <Button title={mode === 'register' ? 'Verify & create account' : 'Verify & log in'} size="lg" full loading={busy} onPress={verify} />
                  <Button title={resendIn > 0 ? `Resend code in ${resendIn}s` : 'Resend code'} variant="ghost" size="sm"
                    disabled={resendIn > 0 || busy} onPress={requestOtp} />
                  <Button title="Change details" variant="ghost" size="sm" onPress={() => { setStep('details'); setServerError(''); }} />
                </>
              )}
              {serverError && onOpenSettings ? <Button title="Server settings" variant="ghost" size="sm" onPress={onOpenSettings} /> : null}
            </Card>
          </View>
        </FadeIn>
      </Screen>
    </KeyboardAvoidingView>
  );
};

export default TeacherAuthScreen;
