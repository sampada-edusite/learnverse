import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors } from '../theme/colors';
import { Sticker } from '../components/Sticker';
import {
  ArrowLeft,
  UserRound,
  Star,
  Phone,
  Smile,
  Sparkles,
} from 'lucide-react-native';

const CLASSES = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th', '9th', '10th'] as const;

interface RegisterScreenProps {
  onBack: () => void;
  onSubmit: (student: { name: string; avatar: string; studentClass: string; studentId: string }) => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onBack, onSubmit }) => {
  const [firstName, setFirstName] = useState('');
  const [studentClass, setStudentClass] = useState<string>('1st');
  const [phone, setPhone] = useState('');
  const [nickName, setNickName] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!/^[A-Za-z\s]{2,30}$/.test(firstName.trim())) {
      newErrors.firstName = 'Please write your first name (letters only)';
    }
    if (!studentClass) {
      newErrors.studentClass = 'Pick your class';
    }
    if (!/^[6-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = 'Enter a valid 10-digit mobile number';
    }
    
    // Strict 4 to 8 characteristics/characters rule for Nick Name
    const trimmedNick = nickName.trim();
    if (trimmedNick.length < 4 || trimmedNick.length > 8) {
      newErrors.nickName = 'Nick Name must be 4 to 8 characters only!';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    const studentData = {
      name: firstName.trim(),
      avatar: nickName.trim(), // Storing Nick Name
      studentClass,
      studentId: 'student_001',
    };

    try {
      await AsyncStorage.setItem('@samsukh_student', JSON.stringify(studentData));
    } catch (e) {
      console.error('Error persisting student info:', e);
    }

    onSubmit(studentData);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Sticker name="apple-books.png" size={54} style={styles.stickerTopRight} />
      <Sticker name="owl.png" size={54} style={styles.stickerBottomLeft} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Responsive Centered Container for Laptop & Mobile */}
          <View style={styles.responsiveWrapper}>
            {/* Header Back Button */}
            <TouchableOpacity onPress={onBack} style={styles.backBtn}>
              <ArrowLeft size={22} color={Colors.primary} />
            </TouchableOpacity>

            <View style={styles.header}>
              <Text style={styles.title}>Hello, Friend!</Text>
              <Text style={styles.subtitle}>Tell us a little about you to begin</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* 1. First Name */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <View style={styles.iconCircle}>
                    <UserRound size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.label}>First Name</Text>
                </View>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="e.g. Aarav"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.input, errors.firstName && styles.inputError]}
                />
                {errors.firstName && <Text style={styles.errorText}>{errors.firstName}</Text>}
              </View>

              {/* 2. Class Selection (1st to 10th) */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <View style={styles.iconCircle}>
                    <Star size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.label}>Class (1st to 10th)</Text>
                </View>

                <View style={styles.classGrid}>
                  {CLASSES.map((cls) => {
                    const isSelected = studentClass === cls;
                    return (
                      <TouchableOpacity
                        key={cls}
                        onPress={() => setStudentClass(cls)}
                        style={[styles.classCard, isSelected && styles.classCardSelected]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.classNumber, isSelected && styles.classTextSelected]}>
                          {cls}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {errors.studentClass && <Text style={styles.errorText}>{errors.studentClass}</Text>}
              </View>

              {/* 3. Parent's Mobile Number */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <View style={styles.iconCircle}>
                    <Phone size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.label}>Parent's Mobile Number</Text>
                </View>
                <View style={styles.phoneRow}>
                  <View style={styles.prefixBadge}>
                    <Text style={styles.prefixText}>+91</Text>
                  </View>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="numeric"
                    maxLength={10}
                    placeholder="98765 43210"
                    placeholderTextColor={Colors.textMuted}
                    style={[styles.input, { flex: 1 }, errors.phone && styles.inputError]}
                  />
                </View>
                {errors.phone && <Text style={styles.errorText}>{errors.phone}</Text>}
              </View>

              {/* 4. Nick Name (4-8 characters rule) */}
              <View style={styles.fieldGroup}>
                <View style={styles.labelRow}>
                  <View style={styles.iconCircle}>
                    <Smile size={16} color={Colors.primary} />
                  </View>
                  <Text style={styles.label}>Nick Name</Text>
                  <Text style={styles.helperText}>(4-8 characters only)</Text>
                </View>
                <TextInput
                  value={nickName}
                  onChangeText={setNickName}
                  maxLength={8}
                  placeholder="e.g. Hero42"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.input, errors.nickName && styles.inputError]}
                />
                {errors.nickName && <Text style={styles.errorText}>{errors.nickName}</Text>}
              </View>

              {/* Submit Button */}
              <TouchableOpacity onPress={handleSubmit} style={styles.submitBtn} activeOpacity={0.85}>
                <Sparkles size={22} color="#ffffff" />
                <Text style={styles.submitBtnText}>Start Learning</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 36,
    alignItems: 'center',
  },
  responsiveWrapper: {
    width: '100%',
    maxWidth: 680,
  },
  backBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  header: {
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 36,
    fontWeight: '900',
    color: Colors.primary,
  },
  subtitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textMuted,
    marginTop: 4,
  },
  formCard: {
    backgroundColor: Colors.card,
    borderRadius: 28,
    padding: 24,
    gap: 18,
    shadowColor: Colors.shadowColor,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 5,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.text,
  },
  helperText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  input: {
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  inputError: {
    borderColor: Colors.danger,
  },
  errorText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.dangerText,
  },
  classGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 6,
  },
  classCard: {
    width: '18%',
    minWidth: 56,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    backgroundColor: Colors.card,
  },
  classCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  classNumber: {
    fontSize: 15,
    fontWeight: '800',
    color: Colors.text,
  },
  classTextSelected: {
    color: '#ffffff',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 8,
  },
  prefixBadge: {
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 18,
    paddingHorizontal: 14,
    backgroundColor: Colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  prefixText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.primary,
  },
  submitBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    borderRadius: 50,
    marginTop: 10,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  submitBtnText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#ffffff',
  },
  stickerTopRight: {
    position: 'absolute',
    top: 20,
    right: 15,
    zIndex: 5,
  },
  stickerBottomLeft: {
    position: 'absolute',
    bottom: 20,
    left: 10,
    zIndex: 5,
  },
});

