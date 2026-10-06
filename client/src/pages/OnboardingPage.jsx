import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  User,
  CreditCard,
  Hash,
  Phone,
  ShieldCheck,
  ArrowRight,
  Loader2,
  Sparkles,
  AlertCircle,
  FileText,
} from 'lucide-react';

export function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: user?.profile?.fullName || user?.name || '',
    registrationNumber: user?.profile?.registrationNumber || '',
    rollNumber: user?.profile?.rollNumber || '',
    phoneNumber: user?.profile?.phoneNumber || '',
    paymentReference: user?.profile?.paymentReference || '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleReset = () => {
    setFormData({
      fullName: user?.profile?.fullName || user?.name || '',
      registrationNumber: '',
      rollNumber: '',
      phoneNumber: '',
      paymentReference: '',
    });
    setErrorMsg('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!formData.fullName.trim()) return setErrorMsg('Full Name is required.');
    if (!formData.registrationNumber.trim()) return setErrorMsg('Registration Number is required.');
    if (!formData.rollNumber.trim()) return setErrorMsg('Roll Number is required.');
    if (!formData.phoneNumber.trim()) return setErrorMsg('Phone Number is required.');

    try {
      setSubmitting(true);
      await updateProfile(formData);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setErrorMsg(err.message || 'Failed to complete profile registration.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="onboarding-page-container">
      {/* Top Header Bar */}
      <header className="onboarding-header-bar">
        <div className="brand">
          <img src="/ieeesb_logo_theme.svg" alt="IEEE Logo" style={{ width: 40, height: 40, objectFit: 'contain' }} />
          <div className="brand-text">
            <h1>
              VORTEX <span>2026</span>
            </h1>
            <p>IEEE SB NIT DURGAPUR</p>
          </div>
        </div>

        <nav className="onboarding-nav-links">
          <span>Home</span>
          <span>Events</span>
          <span>Participant Portal</span>
        </nav>
      </header>

      {/* Main Liquid Glass Registration Card */}
      <div className="onboarding-glass-card">
        <div className="onboarding-specular-edge" />

        {/* Badge & Title Section */}
        <span className="onboarding-badge">START FOR FREE</span>
        <h1 className="onboarding-title">
          Create new account<span>.</span>
        </h1>
        <p className="onboarding-subtitle">
          Already A Member? <a href="/login" onClick={(e) => { e.preventDefault(); navigate('/login'); }}>Log In</a>
        </p>

        {/* Validation Error Alert */}
        {errorMsg && (
          <div style={{
            padding: '12px 16px', borderRadius: 14, marginBottom: 20, fontSize: 12, fontFamily: 'monospace',
            display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(127, 29, 29, 0.7)',
            border: '1px solid rgba(239, 68, 68, 0.4)', color: '#fca5a5', backdropFilter: 'blur(10px)',
          }}>
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Row 1: Full Name & Roll Number side-by-side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="onboarding-field-group">
              <label className="onboarding-label">Full Name</label>
              <div className="onboarding-input-wrap">
                <input
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="e.g. Michal Masiak"
                  className="onboarding-input"
                  required
                />
                <User className="w-4 h-4 onboarding-input-icon" />
              </div>
            </div>

            <div className="onboarding-field-group">
              <label className="onboarding-label">Roll Number</label>
              <div className="onboarding-input-wrap">
                <input
                  type="text"
                  name="rollNumber"
                  value={formData.rollNumber}
                  onChange={handleChange}
                  placeholder="e.g. 21CS8045"
                  className="onboarding-input"
                  required
                />
                <CreditCard className="w-4 h-4 onboarding-input-icon" />
              </div>
            </div>
          </div>

          {/* Row 2: Registration Number */}
          <div className="onboarding-field-group">
            <label className="onboarding-label">Registration Number</label>
            <div className="onboarding-input-wrap">
              <input
                type="text"
                name="registrationNumber"
                value={formData.registrationNumber}
                onChange={handleChange}
                placeholder="e.g. REG-2026-9042"
                className="onboarding-input"
                required
              />
              <Hash className="w-4 h-4 onboarding-input-icon" />
            </div>
          </div>

          {/* Row 3: Phone Number */}
          <div className="onboarding-field-group">
            <label className="onboarding-label">Phone Number</label>
            <div className="onboarding-input-wrap">
              <input
                type="tel"
                name="phoneNumber"
                value={formData.phoneNumber}
                onChange={handleChange}
                placeholder="e.g. +91 9876543210"
                className="onboarding-input"
                required
              />
              <Phone className="w-4 h-4 onboarding-input-icon" />
            </div>
          </div>

          {/* Row 4: Optional Payment Ref / UPI */}
          <div className="onboarding-field-group">
            <label className="onboarding-label">
              UPI / Payment Reference <span style={{ color: '#64748b', fontWeight: 400 }}>(Optional)</span>
            </label>
            <div className="onboarding-input-wrap">
              <input
                type="text"
                name="paymentReference"
                value={formData.paymentReference}
                onChange={handleChange}
                placeholder="e.g. UPI-9988221100 or TXN-40291"
                className="onboarding-input"
              />
              <ShieldCheck className="w-4 h-4 onboarding-input-icon" />
            </div>
          </div>

          {/* Actions Row */}
          <div className="onboarding-actions-row">
            <button
              type="button"
              onClick={handleReset}
              className="onboarding-secondary-btn"
            >
              Reset form
            </button>

            <button
              type="submit"
              disabled={submitting}
              className="onboarding-primary-btn"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Saving profile…
                </>
              ) : (
                <>
                  Create account <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Footer Branding Mark */}
      <footer className="onboarding-footer-watermark">
        <div className="onboarding-brand-logo-mark">
          .AW<span>.</span>
        </div>
      </footer>
    </div>
  );
}
