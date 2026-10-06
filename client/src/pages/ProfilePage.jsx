import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AppShell } from '../components/AppShell';
import {
  User,
  Mail,
  Phone,
  Hash,
  CreditCard,
  Edit3,
  Save,
  X,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Key,
} from 'lucide-react';

export function ProfilePage() {
  const { user, updateProfile } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState({ type: '', text: '' });

  const [formData, setFormData] = useState({
    fullName: '',
    registrationNumber: '',
    rollNumber: '',
    phoneNumber: '',
    paymentReference: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        fullName: user.profile?.fullName || user.name || '',
        registrationNumber: user.profile?.registrationNumber || '',
        rollNumber: user.profile?.rollNumber || '',
        phoneNumber: user.phoneNumber || user.profile?.phoneNumber || '',
        paymentReference: user.profile?.paymentReference || '',
      });
    }
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMsg({ type: '', text: '' });
      await updateProfile(formData);
      setIsEditing(false);
      setMsg({ type: 'success', text: 'Profile updated successfully.' });
    } catch (err) {
      setMsg({ type: 'error', text: 'Update failed: ' + err.message });
    } finally {
      setSaving(false);
    }
  };

  const userInitials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'US';

  const infoItems = [
    { label: 'Full Name',           value: user?.profile?.fullName || user?.name || '—',  icon: User,        key: 'fullName' },
    { label: 'Email Address',       value: user?.email || '—',                              icon: Mail,        key: null },
    { label: 'Phone Number',        value: user?.profile?.phoneNumber || user?.phoneNumber || '—', icon: Phone, key: 'phoneNumber' },
    { label: 'Registration Number', value: user?.profile?.registrationNumber || '—',        icon: Hash,        key: 'registrationNumber' },
    { label: 'Roll Number',         value: user?.profile?.rollNumber || '—',               icon: CreditCard,  key: 'rollNumber' },
    { label: 'Payment Reference',   value: user?.profile?.paymentReference || '—',         icon: Key,         key: 'paymentReference' },
  ];

  const roleLabel = user?.role === 'team_leader'
    ? 'TEAM LEADER'
    : (user?.role?.replace(/_/g, ' ').toUpperCase() || 'PARTICIPANT');

  return (
    <AppShell>
      {/* ── Page Title ── */}
      <div className="page-title-row">
        <div>
          <h1 className="page-title">My Profile</h1>
          <p className="page-subtitle">View and manage your personal information</p>
        </div>
        {!isEditing && (
          <button className="ieee-outline-btn" onClick={() => setIsEditing(true)}>
            <Edit3 className="w-4 h-4" /> Edit Profile
          </button>
        )}
      </div>

      {/* ── Profile Card ── */}
      <section className="prof-card ieee-panel">
        {/* Avatar + identity row */}
        <div className="prof-hero">
          <div className="prof-avatar-lg">
            {user?.avatar
              ? <img src={user.avatar} alt={user.name} />
              : <span>{userInitials}</span>}
            <div className="prof-avatar-badge">
              {user?.isProfileComplete
                ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                : <ShieldAlert className="w-4 h-4 text-amber-400" />}
            </div>
          </div>

          <div className="prof-identity">
            <h2 className="prof-name">
              {(user?.profile?.fullName || user?.name || 'Participant').toUpperCase()}
            </h2>
            <div className="ieee-profile-meta">
              <span>IEEE STUDENT BRANCH</span>
              <b>•</b>
              <span>NIT DURGAPUR</span>
              <b>•</b>
              <span className="ieee-blue-text">{roleLabel}</span>
            </div>
            <p style={{ marginTop: 6, fontSize: 13, color: '#94a3b8' }}>{user?.email}</p>

            <div className="prof-badge-row">
              {user?.isProfileComplete && (
                <span className="prof-badge verified">✓ Profile Verified</span>
              )}
              <span className="prof-badge role">{roleLabel}</span>
            </div>
          </div>
        </div>

        {/* Status message */}
        {msg.text && (
          <div className={`prof-msg ${msg.type}`}>{msg.text}</div>
        )}

        {/* Info grid or edit form */}
        {isEditing ? (
          <form onSubmit={handleSave} className="prof-edit-form">
            <h3 className="prof-section-title"><Edit3 className="w-4 h-4" /> Edit Profile Details</h3>

            <div className="prof-form-grid">
              <div className="prof-field">
                <label>FULL NAME</label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  required
                  placeholder="Your full name"
                />
              </div>
              <div className="prof-field">
                <label>PHONE NUMBER</label>
                <input
                  type="tel"
                  value={formData.phoneNumber}
                  onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
                  required
                  placeholder="10-digit mobile"
                />
              </div>
              <div className="prof-field">
                <label>REGISTRATION NUMBER</label>
                <input
                  type="text"
                  value={formData.registrationNumber}
                  onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                  required
                  placeholder="e.g. 25U10633"
                />
              </div>
              <div className="prof-field">
                <label>ROLL NUMBER</label>
                <input
                  type="text"
                  value={formData.rollNumber}
                  onChange={(e) => setFormData({ ...formData, rollNumber: e.target.value })}
                  required
                  placeholder="e.g. 25CS8142"
                />
              </div>
              <div className="prof-field prof-field-full">
                <label>PAYMENT REFERENCE</label>
                <input
                  type="text"
                  value={formData.paymentReference}
                  onChange={(e) => setFormData({ ...formData, paymentReference: e.target.value })}
                  placeholder="Transaction / UTR reference"
                />
              </div>
            </div>

            <div className="prof-form-actions">
              <button
                type="button"
                className="ieee-outline-btn"
                onClick={() => { setIsEditing(false); setMsg({ type: '', text: '' }); }}
              >
                <X className="w-4 h-4" /> Cancel
              </button>
              <button type="submit" disabled={saving} className="prof-save-btn">
                {saving
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
                  : <><Save className="w-4 h-4" /> Save Changes</>}
              </button>
            </div>
          </form>
        ) : (
          <div className="prof-info-section">
            <h3 className="prof-section-title"><User className="w-4 h-4" /> Account Information</h3>
            <div className="ieee-account-grid">
              {infoItems.map(({ label, value, icon: Icon }) => (
                <div className="ieee-info" key={label}>
                  <span className="ieee-info-icon"><Icon className="w-4 h-4" /></span>
                  <div>
                    <small>{label}</small>
                    <strong>{value}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Account Security Section ── */}
      <section className="ieee-panel" style={{ marginTop: 20 }}>
        <div className="ieee-panel-heading">
          <h2>Account Security</h2>
          <span className="ieee-role-tag">GOOGLE SSO</span>
        </div>
        <div className="prof-security-row">
          <div className="ieee-info" style={{ flex: 1 }}>
            <span className="ieee-info-icon">🔐</span>
            <div>
              <small>Authentication Method</small>
              <strong>Google OAuth 2.0</strong>
            </div>
          </div>
          <div className="ieee-info" style={{ flex: 1 }}>
            <span className="ieee-info-icon">✉</span>
            <div>
              <small>Verified Email</small>
              <strong>{user?.email || '—'}</strong>
            </div>
          </div>
          <div className="ieee-info" style={{ flex: 1 }}>
            <span className="ieee-info-icon">🛡</span>
            <div>
              <small>Role</small>
              <strong>{roleLabel}</strong>
            </div>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
