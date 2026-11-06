import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Hash, Phone, Smile, UserRound } from 'lucide-react-native';
import { Colors } from '../theme/colors';
import { Sticker } from '../components/Sticker';
import { AppBar, Banner, Button, Card, Chip, FadeIn, Row, Screen, Tabs, TextField, Type } from '../ui';
import { Student, StudentApi, errorMessage } from '../config/platformApi';

const CLASSES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ordinal = (n: number) => `${n}${n === 1 ? 'st' : n === 2 ? 'nd' : n === 3 ? 'rd' : 'th'}`;

interface RegisterScreenProps {
  onBack: () => void;
  onSubmit: (student: Student) => void;
  onOpenSettings?: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onBack, onSubmit, onOpenSettings }) => {
  const [mode, setMode] = useState<'new' | 'login'>('new');
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState(1);
  const [phone, setPhone] = useState('');
  const [nickName, setNickName] = useState('');
  const [classCode, setClassCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState('');
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e: Record<string, string> = {};
    const n = name.trim();
    if (n.length < 2 || n.length > 30 || /\d/.test(n)) e.name = 'Please write your name (2–30 letters, no numbers).';
    if (!/^[6-9]\d{9}$/.test(phone.trim())) e.phone = "Enter your parent's 10-digit mobile number.";
    if (mode === 'new') {
      const nick = nickName.trim();
      if (nick && (nick.length < 3 || nick.length > 12)) e.nick = 'Nick name must be 3 to 12 characters.';
      if (classCode.trim() && !/^[A-Za-z0-9]{6}$/.test(classCode.trim())) e.code = 'Class code has 6 letters/numbers.';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async () => {
    setServerError('');
    if (!validate()) return;
    setBusy(true);
    try {
      const res = mode === 'new'
        ? await StudentApi.register({
            name: name.trim(), student_class: studentClass, parent_mobile: phone.trim(),
            nickname: nickName.trim() || undefined, class_code: classCode.trim() || undefined,
          })
        : await StudentApi.login({ name: name.trim(), parent_mobile: phone.trim() });
      onSubmit(res.student);
    } catch (e) {
      setServerError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen header={<AppBar title={mode === 'new' ? 'Hello, friend!' : 'Welcome back!'}
        subtitle={mode === 'new' ? 'Tell us a little about you to begin' : 'Log in with your name and parent’s mobile'}
        onBack={onBack} />}>
        <FadeIn>
          <View style={styles.wrap}>
            <Card style={{ gap: 16 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Tabs value={mode} onChange={(k) => { setMode(k as any); setErrors({}); setServerError(''); }}
                  tabs={[{ key: 'new', label: 'New learner' }, { key: 'login', label: 'I have an account' }]} />
                <Sticker name="owl.png" size={48} />
              </Row>

              <TextField label="First name" value={name} onChangeText={setName} placeholder="e.g. Aarav"
                error={errors.name} icon={<UserRound size={18} color={Colors.textLight} />} maxLength={30} />

              {mode === 'new' && (
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Class</Text>
                  <Row wrap gap={8}>
                    {CLASSES.map((c) => (
                      <Chip key={c} label={ordinal(c)} selected={studentClass === c} onPress={() => setStudentClass(c)} />
                    ))}
                  </Row>
                  {studentClass > 2 && (
                    <Text style={Type.small}>Maths & Marathi content is currently for Std 1–2. You can still practise everything.</Text>
                  )}
                </View>
              )}

              <TextField label="Parent's mobile number" value={phone} onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
                placeholder="98765 43210" keyboardType="phone-pad" maxLength={10} error={errors.phone}
                icon={<Phone size={18} color={Colors.textLight} />} />

              {mode === 'new' && (
                <>
                  <TextField label="Nick name (optional)" value={nickName} onChangeText={setNickName} placeholder="e.g. Hero42"
                    maxLength={12} error={errors.nick} icon={<Smile size={18} color={Colors.textLight} />} />
                  <TextField label="Class code from your teacher (optional)" value={classCode}
                    onChangeText={(t) => setClassCode(t.toUpperCase())} placeholder="e.g. K7Q2MD" autoCapitalize="characters"
                    maxLength={6} error={errors.code} helper="Joins your teacher's class so they can see your progress."
                    icon={<Hash size={18} color={Colors.textLight} />} />
                </>
              )}

              {serverError ? <Banner tone="danger" text={serverError} /> : null}

              <Button title={mode === 'new' ? 'Start learning' : 'Log in'} size="lg" full loading={busy} onPress={submit} />
              {serverError && onOpenSettings ? (
                <Button title="Server settings" variant="ghost" size="sm" onPress={onOpenSettings} />
              ) : null}
            </Card>
          </View>
        </FadeIn>
      </Screen>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  wrap: { width: '100%', maxWidth: 560, alignSelf: 'center' },
  label: { fontSize: 13, fontWeight: '800', color: Colors.textMuted },
});
