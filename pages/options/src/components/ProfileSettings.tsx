import { useState, useEffect, useCallback } from 'react';
import {
  type LocalProfileData,
  type CustomProfileField,
  localDataStore,
  DEFAULT_LOCAL_PROFILE,
} from '@extension/storage';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

interface ProfileSettingsProps {
  isDarkMode?: boolean;
}

const PROFILE_FIELDS: { key: keyof LocalProfileData; label: string; type: string; placeholder: string }[] = [
  { key: 'fullName', label: 'Full Name', type: 'text', placeholder: 'Enter your full name' },
  { key: 'email', label: 'Email', type: 'email', placeholder: 'Enter your email address' },
  { key: 'phone', label: 'Phone', type: 'tel', placeholder: 'Enter your phone number' },
  { key: 'dateOfBirth', label: 'Date of Birth', type: 'date', placeholder: 'YYYY-MM-DD' },
  { key: 'address', label: 'Address', type: 'text', placeholder: 'Enter your street address' },
  { key: 'city', label: 'City', type: 'text', placeholder: 'Enter your city' },
  { key: 'state', label: 'State / Province', type: 'text', placeholder: 'Enter your state or province' },
  { key: 'postalCode', label: 'Postal Code', type: 'text', placeholder: 'Enter your postal/zip code' },
  { key: 'country', label: 'Country', type: 'text', placeholder: 'Enter your country' },
];

export const ProfileSettings = ({ isDarkMode = false }: ProfileSettingsProps) => {
  const [profile, setProfile] = useState<LocalProfileData>(DEFAULT_LOCAL_PROFILE);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  useEffect(() => {
    localDataStore.getAll().then(data => {
      setProfile({
        ...DEFAULT_LOCAL_PROFILE,
        ...data,
        customFields: data.customFields || [],
      });
    });
  }, []);

  const handleFieldChange = useCallback((key: keyof LocalProfileData, value: string) => {
    setProfile(prev => ({ ...prev, [key]: value }));
    setSaveStatus('idle');
  }, []);

  const handleAddCustomField = useCallback(() => {
    const newField: CustomProfileField = {
      id: `custom_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      label: '',
      value: '',
    };
    setProfile(prev => ({
      ...prev,
      customFields: [...(prev.customFields || []), newField],
    }));
    setSaveStatus('idle');
  }, []);

  const handleCustomFieldChange = useCallback((id: string, prop: 'label' | 'value', val: string) => {
    setProfile(prev => ({
      ...prev,
      customFields: (prev.customFields || []).map(f => (f.id === id ? { ...f, [prop]: val } : f)),
    }));
    setSaveStatus('idle');
  }, []);

  const handleRemoveCustomField = useCallback((id: string) => {
    setProfile(prev => ({
      ...prev,
      customFields: (prev.customFields || []).filter(f => f.id !== id),
    }));
    setSaveStatus('idle');
  }, []);

  const handleSave = useCallback(async () => {
    setSaveStatus('saving');
    try {
      const cleanCustomFields = (profile.customFields || []).filter(
        f => (f.label && f.label.trim().length > 0) || (f.value && f.value.trim().length > 0),
      );
      const toSave: LocalProfileData = { ...profile, customFields: cleanCustomFields };
      await localDataStore.updateProfile(toSave);
      setProfile(toSave);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
    }
  }, [profile]);

  const handleClear = useCallback(async () => {
    await localDataStore.updateProfile(DEFAULT_LOCAL_PROFILE);
    setProfile(DEFAULT_LOCAL_PROFILE);
    setShowClearConfirm(false);
    setSaveStatus('idle');
  }, []);

  const hasData =
    Object.entries(profile).some(([k, v]) => {
      if (k === 'customFields') return false;
      return typeof v === 'string' && v.length > 0;
    }) || Boolean(profile.customFields && profile.customFields.some(f => f.value && f.value.length > 0));

  return (
    <section className="space-y-6">
      {/* Privacy Notice */}
      <div
        className={`flex items-start gap-3 rounded-lg border ${
          isDarkMode ? 'border-emerald-800 bg-emerald-900/30' : 'border-emerald-200 bg-emerald-50'
        } p-4`}>
        <span className="text-xl">🔒</span>
        <div>
          <h3 className={`text-sm font-semibold ${isDarkMode ? 'text-emerald-300' : 'text-emerald-800'}`}>
            Stored locally in this browser
          </h3>
          <p className={`text-sm ${isDarkMode ? 'text-emerald-400' : 'text-emerald-700'}`}>
            Your profile data is stored exclusively in your browser's local storage. It is{' '}
            <strong>never sent to the remote AI</strong>, cloud servers, or any third party. The AI only sees abstract
            data keys (like "profile.email"), never your actual information.
          </p>
        </div>
      </div>

      {/* Profile Form */}
      <div
        className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-blue-100 bg-white'} p-6 text-left shadow-sm`}>
        <h2 className={`mb-4 text-left text-xl font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          Your Profile
        </h2>
        <p className={`mb-6 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
          Enter your information below. When the AI agent fills forms on your behalf, it uses these stored values
          locally — without ever sending them over the network.
        </p>

        <div className="space-y-4">
          {PROFILE_FIELDS.map(field => (
            <div key={field.key} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <label
                htmlFor={`profile-${field.key}`}
                className={`w-36 shrink-0 text-sm font-medium ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`}>
                {field.label}
              </label>
              <input
                id={`profile-${field.key}`}
                type={field.type}
                value={(profile[field.key] as string) || ''}
                placeholder={field.placeholder}
                onChange={e => handleFieldChange(field.key, e.target.value)}
                className={`flex-1 rounded-md border px-3 py-2 text-sm ${
                  isDarkMode
                    ? 'border-slate-600 bg-slate-700 text-gray-200 placeholder-gray-500'
                    : 'border-gray-300 bg-white text-gray-700 placeholder-gray-400'
                } focus:outline-none focus:ring-2 focus:ring-sky-500`}
              />
            </div>
          ))}
        </div>

        {/* Other Details Section */}
        <div className="mt-8 border-t border-gray-200 pt-6 dark:border-slate-700">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className={`text-base font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                Other Details
              </h3>
              <p className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                Add custom fields for any other details you want stored locally (e.g. Passport, Company, Emergency
                Contact).
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddCustomField}
              className={`inline-flex items-center gap-1.5 self-start rounded-md px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors sm:self-auto ${
                isDarkMode
                  ? 'border border-sky-500/30 bg-sky-600/20 text-sky-300 hover:bg-sky-600/30'
                  : 'border border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100'
              } focus:outline-none focus:ring-2 focus:ring-sky-500`}>
              <FiPlus size={14} />
              Add Detail
            </button>
          </div>

          {profile.customFields && profile.customFields.length > 0 ? (
            <div className="space-y-3">
              {profile.customFields.map(field => (
                <div
                  key={field.id}
                  className={`flex flex-col gap-2 rounded-lg border p-2.5 sm:flex-row sm:items-center ${
                    isDarkMode ? 'border-slate-700/60 bg-slate-800/50' : 'border-gray-200/80 bg-gray-50/50'
                  }`}>
                  <div className="shrink-0 sm:w-44">
                    <input
                      type="text"
                      value={field.label}
                      placeholder="Detail name (e.g. Passport)"
                      onChange={e => handleCustomFieldChange(field.id, 'label', e.target.value)}
                      className={`w-full rounded-md border px-3 py-1.5 text-sm ${
                        isDarkMode
                          ? 'border-slate-600 bg-slate-700 text-gray-200 placeholder-gray-500'
                          : 'border-gray-300 bg-white text-gray-700 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    />
                  </div>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={field.value}
                      placeholder="Value"
                      onChange={e => handleCustomFieldChange(field.id, 'value', e.target.value)}
                      className={`w-full rounded-md border px-3 py-1.5 text-sm ${
                        isDarkMode
                          ? 'border-slate-600 bg-slate-700 text-gray-200 placeholder-gray-500'
                          : 'border-gray-300 bg-white text-gray-700 placeholder-gray-400'
                      } focus:outline-none focus:ring-2 focus:ring-sky-500`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRemoveCustomField(field.id)}
                    title="Remove this detail"
                    className={`rounded-md p-1.5 transition-colors ${
                      isDarkMode
                        ? 'text-gray-400 hover:bg-slate-700 hover:text-red-400'
                        : 'text-gray-400 hover:bg-gray-200 hover:text-red-600'
                    } focus:outline-none`}>
                    <FiTrash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div
              className={`rounded-md border border-dashed p-4 text-center text-xs ${
                isDarkMode ? 'border-slate-700 text-gray-400' : 'border-gray-200 text-gray-500'
              }`}>
              No other details added yet. Click <strong>&quot;Add Detail&quot;</strong> above to add extra fields like
              Company, Passport, etc.
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition-colors ${
              saveStatus === 'saving'
                ? 'cursor-not-allowed bg-sky-400'
                : saveStatus === 'saved'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : 'bg-sky-600 hover:bg-sky-700'
            } focus:outline-none focus:ring-2 focus:ring-sky-500`}>
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save Profile'}
          </button>

          {hasData && !showClearConfirm && (
            <button
              type="button"
              onClick={() => setShowClearConfirm(true)}
              className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                isDarkMode
                  ? 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              } focus:outline-none focus:ring-2 focus:ring-red-400`}>
              Clear All Data
            </button>
          )}

          {showClearConfirm && (
            <div className="flex items-center gap-2">
              <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Are you sure?</span>
              <button
                type="button"
                onClick={handleClear}
                className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400">
                Yes, clear
              </button>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                className={`rounded-md px-3 py-1.5 text-sm font-medium ${
                  isDarkMode ? 'text-gray-400 hover:text-gray-200' : 'text-gray-500 hover:text-gray-700'
                } focus:outline-none`}>
                Cancel
              </button>
            </div>
          )}
        </div>

        {saveStatus === 'error' && (
          <p className="mt-3 text-sm text-red-500">Failed to save profile. Please try again.</p>
        )}
      </div>

      {/* How it works */}
      <div
        className={`rounded-lg border ${isDarkMode ? 'border-slate-700 bg-slate-800' : 'border-blue-100 bg-white'} p-6 text-left shadow-sm`}>
        <h3 className={`mb-3 text-base font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
          How it works
        </h3>
        <ul className={`list-inside list-disc space-y-1 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
          <li>When you ask the AI to fill a form, it identifies form fields using labels and element types.</li>
          <li>
            The AI instructs the browser to fill each field with a <strong>data key</strong> (e.g.{' '}
            <code className={`rounded px-1 ${isDarkMode ? 'bg-slate-700' : 'bg-gray-100'}`}>profile.email</code>).
          </li>
          <li>
            The browser resolves the data key to your stored value <strong>locally</strong>.
          </li>
          <li>The actual value is typed into the form field directly — it never leaves your device.</li>
          <li>The AI only sees a confirmation message like &quot;Field filled successfully&quot;.</li>
        </ul>
      </div>
    </section>
  );
};
