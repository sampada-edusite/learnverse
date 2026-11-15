/**
 * Teacher: build chapter-wise homework with AI, review it, then assign it in one step.
 * Engine "claude" writes new questions (when the server has an Anthropic API key);
 * engine "ml-bank" picks questions from the chapter's checked question bank using the learner model.
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkles, Trash2 } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Radius, SubjectTheme } from '../../theme/tokens';
import { Banner, Button, Card, Chip, LoadingState, Pill, ProgressBar, Row, Sheet, TextField, Type } from '../../ui';
import { HomeworkApi, HomeworkDraft, errorMessage } from '../../config/platformApi';

interface Props {
  visible: boolean;
  token: string;
  catalog: any;
  studentCount: number;
  onClose: () => void;
  onAssigned: () => void;
}

const addDays = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export const AiHomeworkSheet: React.FC<Props> = ({ visible, token, catalog, studentCount, onClose, onAssigned }) => {
  const [subject, setSubject] = useState('Mathematics');
  const [cls, setCls] = useState(1);
  const [lessonId, setLessonId] = useState('');
  const [count, setCount] = useState(8);
  const [draft, setDraft] = useState<HomeworkDraft | null>(null);
  const [busy, setBusy] = useState<'generate' | 'assign' | null>(null);
  const [error, setError] = useState('');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState(addDays(3));
  const [addPractice, setAddPractice] = useState(true);
  const [done, setDone] = useState('');

  const lessons = (catalog?.lessons || []).filter((l: any) => l.subject === subject && (subject === 'English' || l.class === cls));

  const reset = () => {
    setDraft(null);
    setError('');
    setDone('');
  };

  const close = () => {
    reset();
    onClose();
  };

  const generate = async () => {
    if (!lessonId) return setError('Choose a chapter first.');
    setBusy('generate');
    setError('');
    setDone('');
    try {
      const d = await HomeworkApi.generate(token, lessonId, count);
      setDraft(d);
      setTitle(d.title);
      setInstructions(d.instructions);
      setDueDate(d.due_date);
      setAddPractice(d.students_needing_help.length > 0);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const removeQuestion = (i: number) => {
    if (!draft) return;
    setDraft({ ...draft, questions: draft.questions.filter((_, j) => j !== i) });
  };

  const assign = async () => {
    if (!draft) return;
    if (!draft.questions.length) return setError('Keep at least one question.');
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return setError('Due date must look like 2026-11-20.');
    setBusy('assign');
    setError('');
    try {
      const helpIds = draft.students_needing_help.map((s) => s.student_id);
      const r = await HomeworkApi.assign(token, {
        lesson_id: draft.lesson.lesson_id, title: title.trim() || draft.title, instructions: instructions.trim() || undefined,
        due_date: dueDate || undefined, questions: draft.questions.map(({ question, options, correct_answer }) => ({ question, options, correct_answer, points: 1 })),
        add_practice: addPractice, practice_target: draft.practice_target,
        practice_student_ids: helpIds.length ? helpIds : [],
      });
      setDone(`Assigned to ${r.homework.assigned} student(s)` + (r.practice ? ` · extra practice for ${r.practice.assigned}` : '') + '.');
      setDraft(null);
      onAssigned();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  const footer = draft ? (
    <Row gap={10}>
      <Button title="Start over" variant="secondary" onPress={reset} />
      <View style={{ flex: 1 }}>
        <Button title={`Assign ${draft.questions.length} questions`} full loading={busy === 'assign'} onPress={assign} />
      </View>
    </Row>
  ) : (
    <Button title="✨ Generate homework" full loading={busy === 'generate'} onPress={generate} />
  );

  return (
    <Sheet visible={visible} title="✨ AI homework" onClose={close} wide footer={footer}>
      {visible ? (
        <>
          {done ? <Banner tone="success" text={`✅ ${done}`} /> : null}
          {!draft ? (
            busy === 'generate' ? <LoadingState label="Looking at your class and writing homework…" /> : (
              <>
                <Text style={Type.body}>Pick a chapter. The AI looks at how your class is doing in it and builds homework focused on the skills that need the most practice.</Text>
                <Row wrap gap={8}>
                  {['English', 'Mathematics', 'Marathi'].map((s) => (
                    <Chip key={s} label={`${SubjectTheme[s].icon} ${s}`} color={SubjectTheme[s].color} selected={subject === s}
                      onPress={() => { setSubject(s); setLessonId(''); }} />
                  ))}
                </Row>
                {subject !== 'English' ? (
                  <Row gap={8}>{[1, 2].map((c) => <Chip key={c} label={`Std ${c}`} selected={cls === c} onPress={() => { setCls(c); setLessonId(''); }} />)}</Row>
                ) : null}
                <Row wrap gap={8}>
                  {lessons.map((l: any) => (
                    <Chip key={l.lesson_id} label={`${l.chapter_no}. ${l.lesson_name}`} selected={lessonId === l.lesson_id}
                      color={SubjectTheme[l.subject].color} onPress={() => setLessonId(l.lesson_id)} />
                  ))}
                </Row>
                <Text style={Type.small}>Number of questions</Text>
                <Row gap={8}>{[5, 8, 10, 15].map((n) => <Chip key={n} label={String(n)} selected={count === n} onPress={() => setCount(n)} />)}</Row>
              </>
            )
          ) : (
            <>
              <Row wrap gap={8}>
                <Pill icon={<Sparkles size={12} color={Colors.primary} />}
                  label={draft.engine === 'claude' ? `Written by Claude (${draft.model})` : 'Chosen by the learning model from the question bank'} />
                <Pill label={`${draft.lesson.subject} · Std ${draft.lesson.class}`} color={SubjectTheme[draft.lesson.subject]?.color} light={SubjectTheme[draft.lesson.subject]?.light} />
              </Row>
              {draft.note ? <Banner tone="warning" text={draft.note} /> : null}

              <Card soft style={{ gap: 8 }}>
                <Text style={Type.h3}>How your class is doing in this chapter</Text>
                {draft.focus_concepts.map((c) => (
                  <View key={c.concept_id} style={{ gap: 4 }}>
                    <Row style={{ justifyContent: 'space-between' }}>
                      <Text style={Type.small}>{c.name}</Text>
                      <Text style={Type.small}>{c.readiness === null ? '—' : `${Math.round(c.readiness * 100)}% ready`}</Text>
                    </Row>
                    <ProgressBar value={c.readiness ?? 0} height={6}
                      color={c.readiness === null ? Colors.border : c.readiness >= 0.8 ? '#059669' : c.readiness >= 0.6 ? '#D97706' : '#BE123C'} />
                  </View>
                ))}
                <Text style={Type.small}>
                  {draft.students_needing_help.length
                    ? `Needs extra help: ${draft.students_needing_help.map((s) => s.name).join(', ')}`
                    : studentCount ? 'Nobody in your class is far behind in this chapter.' : 'Add students to see class readiness.'}
                </Text>
              </Card>

              <TextField label="Title" value={title} onChangeText={setTitle} maxLength={100} />
              <TextField label="Instructions for children" value={instructions} onChangeText={setInstructions} multiline maxLength={500} />
              <TextField label="Due date" value={dueDate} onChangeText={setDueDate} placeholder="YYYY-MM-DD" maxLength={10} />

              <Text style={Type.h3}>Questions ({draft.questions.length}) — remove any you don't want</Text>
              {draft.questions.map((q, i) => (
                <View key={`${i}-${q.question}`} style={styles.question}>
                  <Row style={{ alignItems: 'flex-start' }}>
                    <Text style={[Type.body, { flex: 1, fontWeight: '800' }]}>{i + 1}. {q.question}</Text>
                    <Pressable onPress={() => removeQuestion(i)} accessibilityRole="button" accessibilityLabel={`Remove question ${i + 1}`} style={{ padding: 4 }}>
                      <Trash2 size={16} color="#BE123C" />
                    </Pressable>
                  </Row>
                  <Row wrap gap={6}>
                    {q.options.map((o) => (
                      <Pill key={o} label={o === q.correct_answer ? `✓ ${o}` : o}
                        color={o === q.correct_answer ? '#047857' : Colors.textMuted} light={o === q.correct_answer ? '#DCFCE7' : '#F4F1FB'} />
                    ))}
                  </Row>
                  {q.concept || q.difficulty ? <Text style={Type.tiny}>{[q.concept, q.difficulty].filter(Boolean).join(' · ')}</Text> : null}
                </View>
              ))}

              {draft.students_needing_help.length ? (
                <Chip label={`Also assign ${draft.practice_target} practice questions to the ${draft.students_needing_help.length} student(s) who need help`}
                  selected={addPractice} onPress={() => setAddPractice((v) => !v)} />
              ) : null}
            </>
          )}
          {error ? <Banner tone="danger" text={error} /> : null}
        </>
      ) : null}
    </Sheet>
  );
};

const styles = StyleSheet.create({
  question: { gap: 6, padding: 12, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.cardBorder, backgroundColor: '#FFFFFF' },
});
