import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Text, View } from 'react-native';
import { Pencil, Search, Trash2, UserPlus } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import {
  Avatar, Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Row, SectionHeader, Sheet, TextField, Type,
} from '../../ui';
import { Student, TeacherApi, errorMessage } from '../../config/platformApi';

export const confirmAction = (title: string, message: string): Promise<boolean> => {
  if (Platform.OS === 'web') return Promise.resolve(typeof window !== 'undefined' ? window.confirm(`${title}\n\n${message}`) : true);
  return new Promise((resolve) => Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
    { text: 'Yes', style: 'destructive', onPress: () => resolve(true) },
  ]));
};

const empty = { name: '', student_class: 1, parent_mobile: '', roll_no: '', nickname: '' };

export const StudentsTab: React.FC<{ token: string; onOpenStudent: (id: string) => void; onChanged: () => void }> = ({
  token, onOpenStudent, onChanged,
}) => {
  const [students, setStudents] = useState<Student[] | null>(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Student | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<any>(empty);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      setStudents((await TeacherApi.students(token)).students);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setEditing(null); setForm(empty); setFormError(''); setFormOpen(true); };
  const openEdit = (s: Student) => {
    setEditing(s);
    setForm({ name: s.name, student_class: s.student_class, parent_mobile: s.parent_mobile || '', roll_no: s.roll_no || '', nickname: s.nickname || '' });
    setFormError('');
    setFormOpen(true);
  };

  const save = async () => {
    if (form.name.trim().length < 2) return setFormError('Enter the student’s name.');
    if (!/^[6-9]\d{9}$/.test(form.parent_mobile)) return setFormError('Enter a valid 10-digit parent mobile number.');
    setSaving(true);
    setFormError('');
    try {
      const body = { ...form, name: form.name.trim(), roll_no: form.roll_no.trim() || null, nickname: form.nickname.trim() || null };
      if (editing) await TeacherApi.updateStudent(token, editing.student_id, body);
      else await TeacherApi.addStudent(token, body);
      setFormOpen(false);
      await load();
      onChanged();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s: Student) => {
    if (!(await confirmAction('Remove student?', `${s.name} will be removed from your class. Their own learning history is kept.`))) return;
    try {
      await TeacherApi.removeStudent(token, s.student_id);
      await load();
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const shown = (students || []).filter((s) => !query || s.name.toLowerCase().includes(query.toLowerCase()) || (s.roll_no || '').includes(query));

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title="My students" subtitle={students ? `${students.length} in your class` : undefined}
        action={<Button title="Add student" size="sm" icon={<UserPlus size={14} color="#FFF" />} onPress={openAdd} />} />
      {students && students.length > 4 ? (
        <TextField label="Search" value={query} onChangeText={setQuery} placeholder="Name or roll number"
          icon={<Search size={16} color={Colors.textLight} />} />
      ) : null}
      {!students && !error ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : shown.length === 0 ? (
        <Card><EmptyState emoji="🧑‍🎓" title={query ? 'No match' : 'No students yet'}
          message={query ? 'Try another name.' : 'Add a student, or share your class code from the Overview tab.'} /></Card>
      ) : shown.map((s) => (
        <Card key={s.student_id} soft onPress={() => onOpenStudent(s.student_id)} accessibilityLabel={`Open ${s.name}`}>
          <Row>
            <Avatar name={s.name} />
            <View style={{ flex: 1 }}>
              <Text style={Type.h3} numberOfLines={1}>{s.roll_no ? `${s.roll_no}. ` : ''}{s.name}{s.nickname ? ` (${s.nickname})` : ''}</Text>
              <Text style={Type.small} numberOfLines={1}>
                Std {s.student_class} · {s.summary?.attempts ? `${s.summary.accuracy}% accuracy · ${s.summary.attempts} answers` : 'No practice yet'}
                {s.summary?.games_played ? ` · ${s.summary.games_played} games` : ''}
              </Text>
            </View>
            <Button title="Edit" variant="ghost" size="sm" icon={<Pencil size={16} color={Colors.primary} />} onPress={() => openEdit(s)} />
            <Button title="Remove" variant="ghost" size="sm" icon={<Trash2 size={16} color="#BE123C" />} onPress={() => remove(s)} />
          </Row>
        </Card>
      ))}

      <Sheet visible={formOpen} title={editing ? `Edit ${editing.name}` : 'Add a student'} onClose={() => setFormOpen(false)}
        footer={<Button title={editing ? 'Save changes' : 'Add student'} full loading={saving} onPress={save} />}>
        <TextField label="Name" value={form.name} onChangeText={(t) => setForm({ ...form, name: t })} placeholder="e.g. Aarav Shinde" maxLength={40} />
        <View style={{ gap: 8 }}>
          <Text style={Type.small}>Class</Text>
          <Row wrap gap={8}>
            {[1, 2, 3, 4, 5].map((c) => <Chip key={c} label={`Std ${c}`} selected={form.student_class === c} onPress={() => setForm({ ...form, student_class: c })} />)}
          </Row>
        </View>
        <TextField label="Parent's mobile" value={form.parent_mobile} keyboardType="phone-pad" maxLength={10}
          onChangeText={(t) => setForm({ ...form, parent_mobile: t.replace(/\D/g, '') })} placeholder="98765 43210"
          helper="The student logs in with their name and this number." />
        <Row gap={12}>
          <View style={{ flex: 1 }}><TextField label="Roll no. (optional)" value={form.roll_no} maxLength={10} onChangeText={(t) => setForm({ ...form, roll_no: t })} /></View>
          <View style={{ flex: 1 }}><TextField label="Nick name (optional)" value={form.nickname} maxLength={20} onChangeText={(t) => setForm({ ...form, nickname: t })} /></View>
        </Row>
        {formError ? <Banner tone="danger" text={formError} /> : null}
      </Sheet>
    </View>
  );
};
