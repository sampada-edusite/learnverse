import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pencil, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Radius, SubjectTheme } from '../../theme/tokens';
import {
  Banner, Button, Card, Chip, EmptyState, ErrorState, LoadingState, Row, SectionHeader, Sheet, TextField, Type,
} from '../../ui';
import { QuizQuestion, TeacherApi, errorMessage } from '../../config/platformApi';
import { confirmAction } from './StudentsTab';

const blankQuestion = (): QuizQuestion => ({ question: '', options: ['', '', '', ''], correct_answer: '', points: 1 });

export const QuizzesTab: React.FC<{ token: string }> = ({ token }) => {
  const [quizzes, setQuizzes] = useState<any[] | null>(null);
  const [lessons, setLessons] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<any>(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [gen, setGen] = useState({ lesson_id: '', count: 5, busy: false });
  const [results, setResults] = useState<any>(null);

  const load = useCallback(async () => {
    setError('');
    try {
      const [q, c] = await Promise.all([TeacherApi.quizzes(token), TeacherApi.catalog(token)]);
      setQuizzes(q.quizzes);
      setLessons(c.lessons);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const newQuiz = () => {
    setEditor({ quiz_id: null, title: '', subject: 'Mathematics', student_class: 1, time_limit_sec: null, questions: [blankQuestion()] });
    setFormError('');
  };

  const editQuiz = async (id: number) => {
    try {
      const { quiz } = await TeacherApi.quiz(token, id);
      setEditor({ ...quiz, questions: quiz.questions.map((q: any) => ({ ...q, options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)) })) });
      setFormError('');
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const setQ = (i: number, patch: Partial<QuizQuestion>) =>
    setEditor((ed: any) => ({ ...ed, questions: ed.questions.map((q: any, j: number) => (j === i ? { ...q, ...patch } : q)) }));

  const generate = async () => {
    if (!gen.lesson_id) return setFormError('Pick a chapter to draft questions from.');
    setGen({ ...gen, busy: true });
    try {
      const r = await TeacherApi.generateQuiz(token, gen.lesson_id, gen.count);
      const drafts = r.questions.map((q) => ({ ...q, options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)) }));
      setEditor((ed: any) => ({ ...ed, questions: [...ed.questions.filter((q: any) => q.question.trim()), ...drafts] }));
      setFormError(r.questions.length ? '' : 'That chapter has no multiple-choice questions to draft from.');
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setGen((g) => ({ ...g, busy: false }));
    }
  };

  const save = async () => {
    const ed = editor;
    if (ed.title.trim().length < 2) return setFormError('Give the quiz a title.');
    const questions = ed.questions.map((q: any) => ({ ...q, question: q.question.trim(), options: q.options.map((o: string) => o.trim()).filter(Boolean) }));
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question) return setFormError(`Question ${i + 1} is empty.`);
      if (q.options.length < 2) return setFormError(`Question ${i + 1} needs at least 2 options.`);
      if (!q.options.includes(q.correct_answer)) return setFormError(`Question ${i + 1}: tap the correct option.`);
    }
    if (!questions.length) return setFormError('Add at least one question.');
    setSaving(true);
    setFormError('');
    try {
      const body = { title: ed.title.trim(), subject: ed.subject, student_class: ed.student_class, time_limit_sec: ed.time_limit_sec || undefined, questions };
      if (ed.quiz_id) await TeacherApi.updateQuiz(token, ed.quiz_id, body);
      else await TeacherApi.createQuiz(token, body);
      setEditor(null);
      load();
    } catch (e) {
      setFormError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (q: any) => {
    if (!(await confirmAction('Delete quiz?', `“${q.title}” and its results will be deleted.`))) return;
    try {
      await TeacherApi.deleteQuiz(token, q.quiz_id);
      load();
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const showResults = async (id: number) => {
    try {
      setResults((await TeacherApi.quiz(token, id)).quiz);
    } catch (e) {
      setError(errorMessage(e));
    }
  };

  const chapterChoices = lessons.filter((l) => editor && l.subject === editor.subject && (l.subject === 'English' || l.class === editor.student_class));

  return (
    <View style={{ gap: 14 }}>
      <SectionHeader title="Quizzes" subtitle="Auto-graded multiple-choice quizzes"
        action={<Button title="New quiz" size="sm" icon={<Plus size={14} color="#FFF" />} onPress={newQuiz} />} />
      {error ? <Banner tone="danger" text={error} /> : null}
      {!quizzes && !error ? <LoadingState /> : !quizzes ? <ErrorState message={error} onRetry={load} /> : quizzes.length === 0 ? (
        <Card><EmptyState emoji="📝" title="No quizzes yet" message="Write your own questions or draft them from any chapter in one tap."
          action={<Button title="Create quiz" onPress={newQuiz} />} /></Card>
      ) : quizzes.map((q) => (
        <Card key={q.quiz_id} soft style={{ gap: 8 }}>
          <Row>
            <Text style={{ fontSize: 24 }}>{SubjectTheme[q.subject]?.icon}</Text>
            <View style={{ flex: 1 }}>
              <Text style={Type.h3}>{q.title}</Text>
              <Text style={Type.small}>{q.subject} · Std {q.student_class} · {q.question_count} questions{q.time_limit_sec ? ` · ${Math.round(q.time_limit_sec / 60)} min` : ''}</Text>
            </View>
          </Row>
          <Row wrap style={{ justifyContent: 'space-between' }}>
            <Text style={Type.small}>{q.submissions} submissions{q.average !== null ? ` · average ${q.average}%` : ''}</Text>
            <Row gap={4}>
              <Button title="Results" variant="secondary" size="sm" onPress={() => showResults(q.quiz_id)} />
              <Button title="Edit" variant="ghost" size="sm" icon={<Pencil size={14} color={Colors.primary} />} onPress={() => editQuiz(q.quiz_id)} />
              <Button title="Delete" variant="ghost" size="sm" icon={<Trash2 size={14} color="#BE123C" />} onPress={() => remove(q)} />
            </Row>
          </Row>
        </Card>
      ))}

      <Sheet visible={!!editor} title={editor?.quiz_id ? 'Edit quiz' : 'New quiz'} onClose={() => setEditor(null)} wide
        footer={<Button title="Save quiz" full loading={saving} onPress={save} />}>
        {editor ? (
          <>
            <TextField label="Title" value={editor.title} onChangeText={(t) => setEditor({ ...editor, title: t })} placeholder="e.g. Addition check" maxLength={100} />
            <Row wrap gap={8}>
              {['English', 'Mathematics', 'Marathi'].map((s) => (
                <Chip key={s} label={`${SubjectTheme[s].icon} ${s}`} color={SubjectTheme[s].color} selected={editor.subject === s}
                  onPress={() => setEditor({ ...editor, subject: s })} />
              ))}
            </Row>
            <Row wrap gap={8}>
              {[1, 2, 3, 4].map((c) => <Chip key={c} label={`Std ${c}`} selected={editor.student_class === c} onPress={() => setEditor({ ...editor, student_class: c })} />)}
              <Text style={Type.small}>  Time limit:</Text>
              {[[null, 'None'], [300, '5 min'], [600, '10 min'], [900, '15 min']].map(([v, l]) => (
                <Chip key={String(l)} label={String(l)} selected={editor.time_limit_sec === v} onPress={() => setEditor({ ...editor, time_limit_sec: v })} />
              ))}
            </Row>

            <Card soft style={{ gap: 10 }}>
              <Row><Sparkles size={16} color="#6D28D9" /><Text style={Type.h3}>Draft questions from a chapter</Text></Row>
              <Row wrap gap={6}>
                {chapterChoices.map((l) => (
                  <Chip key={l.lesson_id} label={`${l.chapter_no}. ${l.lesson_name}`} selected={gen.lesson_id === l.lesson_id}
                    onPress={() => setGen({ ...gen, lesson_id: l.lesson_id })} />
                ))}
              </Row>
              <Row wrap gap={8}>
                {[3, 5, 10].map((n) => <Chip key={n} label={`${n} questions`} selected={gen.count === n} onPress={() => setGen({ ...gen, count: n })} />)}
                <Button title="Add drafts" size="sm" variant="secondary" loading={gen.busy} onPress={generate} />
              </Row>
            </Card>

            {editor.questions.map((q: any, i: number) => (
              <Card key={i} style={{ gap: 10 }}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={Type.h3}>Question {i + 1}</Text>
                  <Row gap={6}>
                    {[1, 2, 3].map((p) => <Chip key={p} label={`${p} pt`} selected={q.points === p} onPress={() => setQ(i, { points: p })} />)}
                    {editor.questions.length > 1 ? (
                      <Button title="Remove" variant="ghost" size="sm" onPress={() => setEditor({ ...editor, questions: editor.questions.filter((_: any, j: number) => j !== i) })} />
                    ) : null}
                  </Row>
                </Row>
                <TextField label="Question" value={q.question} onChangeText={(t) => setQ(i, { question: t })} placeholder="Type the question" maxLength={300} />
                <Text style={Type.small}>Options — tap the circle next to the correct answer</Text>
                {q.options.map((o: string, k: number) => {
                  const correct = o.trim() && q.correct_answer === o.trim();
                  return (
                    <Row key={k} gap={8}>
                      <Pressable accessibilityRole="radio" accessibilityState={{ checked: !!correct }} accessibilityLabel={`Mark option ${k + 1} correct`}
                        onPress={() => o.trim() && setQ(i, { correct_answer: o.trim() })}
                        style={[styles.radio, correct ? styles.radioOn : null]}>{correct ? <Text style={{ color: '#FFF', fontWeight: '900' }}>✓</Text> : null}</Pressable>
                      <View style={{ flex: 1 }}>
                        <TextField label={`Option ${k + 1}${k >= 2 ? ' (optional)' : ''}`} value={o} maxLength={120}
                          onChangeText={(t) => setQ(i, {
                            options: q.options.map((x: string, m: number) => (m === k ? t : x)),
                            correct_answer: q.correct_answer === o.trim() ? t.trim() : q.correct_answer,
                          })} />
                      </View>
                    </Row>
                  );
                })}
              </Card>
            ))}
            <Button title="Add question" variant="secondary" icon={<Plus size={14} color={Colors.primary} />}
              onPress={() => setEditor({ ...editor, questions: [...editor.questions, blankQuestion()] })} />
            {formError ? <Banner tone="danger" text={formError} /> : null}
          </>
        ) : null}
      </Sheet>

      <Sheet visible={!!results} title={results ? `Results · ${results.title}` : ''} onClose={() => setResults(null)}>
        {results?.submissions?.length ? results.submissions.map((s: any) => (
          <Row key={s.submission_id}>
            <Text style={[Type.h3, { flex: 1 }]}>{s.name || s.student_id}</Text>
            <Text style={Type.h3}>{s.score}/{s.max_score}</Text>
            <Text style={Type.small}>{s.submitted_at.slice(0, 16)}</Text>
          </Row>
        )) : <EmptyState emoji="⏳" title="No submissions yet" message="Assign this quiz from the Homework tab." />}
      </Sheet>
    </View>
  );
};

const styles = StyleSheet.create({
  radio: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: '#CBB2C1', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  radioOn: { backgroundColor: '#059669', borderColor: '#059669' },
});
