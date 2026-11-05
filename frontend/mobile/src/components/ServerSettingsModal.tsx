import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { getApiUrl, setApiUrl } from '../config/api';
import { Colors } from '../theme/colors';
import { Server, CheckCircle, RefreshCw, X } from 'lucide-react-native';

interface ServerSettingsModalProps {
  visible: boolean;
  onClose: () => void;
}

export const ServerSettingsModal: React.FC<ServerSettingsModalProps> = ({
  visible,
  onClose,
}) => {
  const [urlInput, setUrlInput] = useState<string>('');
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; success: boolean } | null>(null);

  useEffect(() => {
    if (visible) {
      setUrlInput(getApiUrl());
      setStatusMsg(null);
    }
  }, [visible]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setStatusMsg(null);
    let targetUrl = urlInput.trim();
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = `http://${targetUrl}`;
    }
    targetUrl = targetUrl.replace(/\/+$/, '');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${targetUrl}/health`, { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        setStatusMsg({ text: 'Connected successfully to FastAPI Backend! ✅', success: true });
      } else {
        setStatusMsg({ text: `Server replied with HTTP status ${res.status}`, success: false });
      }
    } catch (err: any) {
      setStatusMsg({
        text: `Connection failed. Make sure FastAPI server is running on port 8000 and accessible on your Wi-Fi network.`,
        success: false,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    if (!urlInput.trim()) return;
    await setApiUrl(urlInput);
    Alert.alert('Settings Saved', `Backend API URL updated to:\n${getApiUrl()}`);
    onClose();
  };

  const handleResetDefault = async () => {
    const defaultUrl = 'http://10.0.2.2:8000';
    setUrlInput(defaultUrl);
    await setApiUrl(defaultUrl);
    setStatusMsg({ text: 'Reset to Android Emulator default (10.0.2.2:8000)', success: true });
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Server size={22} color={Colors.primary} />
              <Text style={styles.title}>Backend API Settings</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={styles.description}>
            When testing on your Android phone using Expo Go, enter your computer's local Wi-Fi IP address (e.g.{' '}
            <Text style={styles.bold}>192.168.1.15:8000</Text>):
          </Text>

          <View style={styles.inputContainer}>
            <TextInput
              value={urlInput}
              onChangeText={setUrlInput}
              placeholder="e.g. http://192.168.1.100:8000"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>

          {statusMsg && (
            <View
              style={[
                styles.statusBox,
                statusMsg.success ? styles.statusSuccess : styles.statusError,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  statusMsg.success ? styles.statusSuccessText : styles.statusErrorText,
                ]}
              >
                {statusMsg.text}
              </Text>
            </View>
          )}

          <View style={styles.btnRow}>
            <TouchableOpacity
              onPress={handleTestConnection}
              disabled={isTesting}
              style={[styles.btn, styles.btnOutline]}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <>
                  <RefreshCw size={16} color={Colors.primary} />
                  <Text style={styles.btnOutlineText}>Test Connection</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={[styles.btn, styles.btnPrimary]}>
              <CheckCircle size={16} color="#ffffff" />
              <Text style={styles.btnPrimaryText}>Save & Use</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity onPress={handleResetDefault} style={styles.resetBtn}>
            <Text style={styles.resetText}>Reset to 10.0.2.2 (Emulator)</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text,
  },
  closeBtn: {
    padding: 4,
  },
  description: {
    fontSize: 13,
    color: Colors.textMuted,
    lineHeight: 18,
    marginBottom: 16,
  },
  bold: {
    fontWeight: '700',
    color: Colors.primary,
  },
  inputContainer: {
    marginBottom: 14,
  },
  input: {
    borderWidth: 2,
    borderColor: Colors.inputBorder,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.text,
    backgroundColor: Colors.background,
  },
  statusBox: {
    borderRadius: 14,
    padding: 12,
    marginBottom: 14,
  },
  statusSuccess: {
    backgroundColor: Colors.successLight,
  },
  statusError: {
    backgroundColor: Colors.dangerLight,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  statusSuccessText: {
    color: Colors.successText,
  },
  statusErrorText: {
    color: Colors.dangerText,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 6,
  },
  btn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    borderRadius: 50,
  },
  btnOutline: {
    borderWidth: 2,
    borderColor: Colors.primary,
  },
  btnOutlineText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.primary,
  },
  btnPrimary: {
    backgroundColor: Colors.primary,
  },
  btnPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ffffff',
  },
  resetBtn: {
    marginTop: 14,
    alignItems: 'center',
  },
  resetText: {
    fontSize: 12,
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
});
