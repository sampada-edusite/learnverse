import React, { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Plus, Trash2 } from 'lucide-react-native';
import { SubjectTheme } from '../../theme/tokens';
import {
  Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingState, ProgressBar, Row, SectionHeader, Sheet, StatusPill,
  Tabs, TextField, Type,
} from '../../ui';
import { TeacherApi, errorMessage } from '../../config/platformApi';
import { confirmAction } from './StudentsTab';

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

const newForm = () => ({ kind: 'lesson', subject: 'Mathematics', cls: 1, ref_id: '', level: 1, target_count: 5,
  due_date: addDays(3), title: '', instructions: '', everyone: true, student_ids: [] as string[] });

export const AssignmentsTab: React.FC<{ token: string }> = ({ token }) => {
  const [items, setItems] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [catalog, setCatalog] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [form, setForm] = useState<any>(() => newForm());
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [a, c, s] = await Promise.all([TeacherApi.assignments(token), TeacherApi.catalog(token), TeacherApi.students(token)]);
      setItems(a.assignments);
      setCatalog(c);
      setStudents(s.students);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const startNew = () => {
    setForm(newForm());
    setFormError('');
    setOpen(true);
  };

  const refTitle = () => {
    if (form.kind === 'lesson') return catalog?.lessons.find((l: any) => l.lesson_id === form.ref_id)?.lesson_name;
    if (form.kind === 'quiz') return catalog?.quizzes.find((q: any) => String(q.quiz_id) === form.ref_id)?.title;
    return catalog?.games.find((g: any) => g.game_id === form.ref_id)?.title;
  };

  const save = async () => {
    if (!form.ref_id) return setFormError(`Choose a ${form.kind === 'lesson' ? 'chapter' : form.kind}.`);
    if (form.due_date && !/^\d{4}-\d{2}-\d{2}$/.test(form.due_date)) return setFormError('Due date must look like 2026-11-20.');
    if (!form.everyone && !form.student_ids.length) return setFormError('Pick at least one student.');
    setSaving(true);
    setFormError('');
    try {
      const title = form.title.trim() || `${form.kind === 'lesson' ? 'Practise' : form.kind === 'quiz' ? 'Quiz' : 'Play'}: ${refTitle()}`;
      await TeacherApi.createAssignment(token, {
        title, kind: form.kind, ref_id: form.ref_id,
        level: form.kind === 'game' ? form.level : undefined,
        target_count: form.kind === 'lesson' ? form.target_count : undefined,
        instructions: form.instructions.trim() || undefined, due_date: form.due_date || undefined,
        student_ids: form.everyone ? [] : form.student_ids,
      });
      setOpen(false);
      load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (a: any) => {
    if (!(await confirmAction('Delete assignment?', `“${a.title}” will be removed for all students.`))) return;
    try {
      await TeacherApi.deleteAssignment(token, a.assignment_id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const openDetail = async (a: any) => {
    setDetail({ loading: true, assignment: a });
    try {
      setDetail(await TeacherApi.assignment(token, a.assignment_id));
    } catch (e) {
      setDetail({ error: errorMessage(e), assignment: a });
    }
  };

  const lessons = (catalog?.lessons || []).filter((l: any) => l.subject === form.subject && (form.subject === 'English' || l.class === form.cls));

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title="Homework" subtitle="Assign practice, quizzes and games"
        action={<Button title="New" size="sm" icon={<Plus size={14} color="#FFF" />} onPress={startNew} />} />
      {!items && !error ? <LoadingState /> : error ? <ErrorState message={error} onRetry={load} /> : items!.length === 0 ? (
        <Card><EmptyState emoji="📋" title="No homework yet" message="Create an assignment and your students will see it on their dashboard."
          action={<Button title="Create assignment" onPress={startNew} />} /></Card>
      ) : items!.map((a) => (
        <Card key={a.assignment_id} soft onPress={() => openDetail(a)} accessibilityLabel={`Open ${a.title}`} style={{ gap: 8 }}>
          <Row style={{ alignItems: 'flex-start' }}>
            <Text style={{ fontSize: 24 }}>{a.kind === 'quiz' ? '📝' : a.kind === 'game' ? '🎮' : '📚'}</Text>
            <View style={{ flex: 1 }}>
              <Text style={Type.h3}>{a.title}</Text>
              <Text style={Type.small}>{a.ref_title}{a.level ? ` · Level ${a.level}` : ''}{a.target_count ? ` · ${a.target_count} questions` : ''}
                {a.due_date ? ` · due ${a.due_date}` : ''}</Text>
            </View>
            <Button title="Delete" variant="ghost" size="sm" icon={<Trash2 size={14} color="#BE123C" />} onPress={() => remove(a)} />
          </Row>
          <ProgressBar value={a.assigned ? a.completed / a.assigned : 0} color="#059669" height={6} />
          <Text style={Type.small}>{a.completed}/{a.assigned} completed{a.overdue ? ` · ${a.overdue} overdue` : ''}</Text>
        </Card>
      ))}

      <Sheet visible={open} title="New assignment" onClose={() => setOpen(false)} wide
        footer={<Button title="Assign" full loading={saving} onPress={save} />}>
        {open ? (<>
        <Tabs value={form.kind} onChange={(k) => setForm({ ...form, kind: k, ref_id: '' })}
          tabs={[{ key: 'lesson', label: '📚 Chapter practice' }, { key: 'quiz', label: '📝 Quiz' }, { key: 'game', label: '🎮 Game' }]} />

        {form.kind === 'lesson' ? (
          <>
            <Row wrap gap={8}>
              {['English', 'Mathematics', 'Marathi'].map((s) => (
                <Chip key={s} label={`${SubjectTheme[s].icon} ${s}`} color={SubjectTheme[s].color} selected={form.subject === s}
                  onPress={() => setForm({ ...form, subject: s, ref_id: '' })} />
              ))}
            </Row>
            {form.subject !== 'English' ? (
              <Row gap={8}>{[1, 2].map((c) => <Chip key={c} label={`Std ${c}`} selected={form.cls === c} onPress={() => setForm({ ...form, cls: c, ref_id: '' })} />)}</Row>
            ) : null}
            <Row wrap gap={8}>
              {lessons.map((l: any) => (
                <Chip key={l.lesson_id} label={`${l.chapter_no}. ${l.lesson_name}`} selected={form.ref_id === l.lesson_id}
                  color={SubjectTheme[l.subject].color} onPress={() => setForm({ ...form, ref_id: l.lesson_id })} />
              ))}
            </Row>
            <Text style={Type.small}>Questions to practise</Text>
            <Row gap={8}>{[3, 5, 10, 15].map((n) => <Chip key={n} label={String(n)} selected={form.target_count === n} onPress={() => setForm({ ...form, target_count: n })} />)}</Row>
          </>
        ) : form.kind === 'quiz' ? (
          catalog?.quizzes.length ? (
            <Row wrap gap={8}>
              {catalog.quizzes.map((q: any) => (
                <Chip key={q.quiz_id} label={`${q.title} (${q.subject})`} selected={form.ref_id === String(q.quiz_id)}
                  onPress={() => setForm({ ...form, ref_id: String(q.quiz_id) })} />
              ))}
            </Row>
          ) : <Banner tone="warning" text="You have no quizzes yet. Create one in the Quizzes tab first." />
        ) : (
          <>
            <Row wrap gap={8}>
              {(catalog?.games || []).map((g: any) => (
                <Chip key={g.game_id} label={`${g.icon} ${g.title}`} color={g.color} selected={form.ref_id === g.game_id}
                  onPress={() => setForm({ ...form, ref_id: g.game_id })} />
              ))}
            </Row>
            <Text style={Type.small}>Minimum level to play</Text>
            <Row gap={8}>{[1, 2, 3, 4, 5].map((n) => <Chip key={n} label={`L${n}`} selected={form.level === n} onPress={() => setForm({ ...form, level: n })} />)}</Row>
          </>
        )}

        <TextField label="Title (optional)" value={form.title} onChangeText={(t) => setForm({ ...form, title: t })} placeholder={refTitle() ? `e.g. Practise: ${refTitle()}` : 'Auto-named if left empty'} maxLength={100} />
        <TextField label="Instructions (optional)" value={form.instructions} onChangeText={(t) => setForm({ ...form, instructions: t })} placeholder="e.g. Do this before Friday" multiline maxLength={500} />
        <View style={{ gap: 8 }}>
          <TextField label="Due date" value={form.due_date} onChangeText={(t) => setForm({ ...form, due_date: t })} placeholder="YYYY-MM-DD" maxLength={10} />
          <Row wrap gap={8}>
            {[['Tomorrow', 1], ['3 days', 3], ['1 week', 7], ['No due date', -1]].map(([l, n]) => (
              <Chip key={String(l)} label={String(l)} onPress={() => setForm({ ...form, due_date: Number(n) < 0 ? '' : addDays(Number(n)) })} />
            ))}
          </Row>
        </View>
        <View style={{ gap: 8 }}>
          <Text style={Type.small}>Assign to</Text>
          <Row wrap gap={8}>
            <Chip label={`Whole class (${students.length})`} selected={form.everyone} onPress={() => setForm({ ...form, everyone: true })} />
            <Chip label="Choose students" selected={!form.everyone} onPress={() => setForm({ ...form, everyone: false })} />
          </Row>
          {!form.everyone ? (
            <Row wrap gap={8}>
              {students.map((s) => {
                const sel = form.student_ids.includes(s.student_id);
                return <Chip key={s.student_id} label={s.name} selected={sel} onPress={() => setForm({
                  ...form, student_ids: sel ? form.student_ids.filter((x: string) => x !== s.student_id) : [...form.student_ids, s.student_id],
                })} />;
              })}
            </Row>
          ) : null}
        </View>
        {formError ? <Banner tone="danger" text={formError} /> : null}
        </>) : null}
      </Sheet>

      <Sheet visible={!!detail} title={detail?.assignment?.title || 'Assignment'} onClose={() => setDetail(null)}>
        {detail?.loading ? <LoadingState /> : detail?.error ? <ErrorState message={detail.error} /> : detail ? (
          <>
            <Text style={Type.small}>{detail.assignment.ref_title}{detail.assignment.due_date ? ` · due ${detail.assignment.due_date}` : ''}</Text>
            {detail.assignment.instructions ? <Text style={Type.body}>“{detail.assignment.instructions}”</Text> : null}
            {detail.students.map((s: any) => (
              <Row key={s.student_id}>
                <View style={{ flex: 1 }}>
                  <Text style={Type.h3}>{s.name}</Text>
                  <Text style={Type.small}>{s.detail}</Text>
                </View>
                <StatusPill status={s.status} />
              </Row>
            ))}
          </>
        ) : null}
      </Sheet>
    </View>
  );
};
