import { useEffect, useState } from 'react';

export function useDesktopBridge() {
  const [available, setAvailable] = useState(false);
  const [settings, setSettings] = useState({
    toggleHotkey: '',
    newNoteHotkey: '',
    newMeetingHotkey: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const bridge = window.noteflowDesktop;
    if (!bridge?.isAvailable) {
      setLoading(false);
      return;
    }

    setAvailable(true);
    bridge
      .getSettings()
      .then((nextSettings) => {
        setSettings({
          toggleHotkey: nextSettings.toggleHotkey || '',
          newNoteHotkey: nextSettings.newNoteHotkey || '',
          newMeetingHotkey: nextSettings.newMeetingHotkey || '',
        });
      })
      .catch((err) => {
        setError(err.message);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  async function saveSettings(nextSettings) {
    const bridge = window.noteflowDesktop;
    if (!bridge?.isAvailable) return;

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const result = await bridge.updateSettings(nextSettings);
      setSettings({
        toggleHotkey: result.toggleHotkey || '',
        newNoteHotkey: result.newNoteHotkey || '',
        newMeetingHotkey: result.newMeetingHotkey || '',
      });
      setMessage('Desktop shortcuts saved');
      return result;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setSaving(false);
    }
  }

  return {
    available,
    settings,
    loading,
    saving,
    error,
    message,
    saveSettings,
    clearStatus: () => {
      setError('');
      setMessage('');
    },
  };
}
