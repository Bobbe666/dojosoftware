import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Plus, X, Star, Check, AlertCircle, CreditCard, DollarSign } from 'lucide-react';
import '../styles/BankTabs.css';

const BankTabs = ({ dojoId }) => {
  const [banken, setBanken] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [showNewBankDialog, setShowNewBankDialog] = useState(false);

  // Form State für aktuelle Bank
  const [formData, setFormData] = useState({
    bank_name: '',
    bank_typ: 'bank',
    ist_aktiv: true,
    ist_standard: false,
    iban: '',
    bic: '',
    kontoinhaber: '',
    sepa_glaeubiger_id: '',
    stripe_publishable_key: '',
    stripe_secret_key: '',
    stripe_account_id: '',
    paypal_email: '',
    paypal_client_id: '',
    paypal_client_secret: '',
    notizen: ''
  });

  useEffect(() => {
    if (dojoId) {
      loadBanken();
    }
  }, [dojoId]);

  const loadBanken = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`/dojo-banken/${dojoId}`);
      
      // Wenn keine Banken vorhanden, Standard-Tabs anlegen
      if (response.data.length === 0) {
        await axios.post(`/dojo-banken/${dojoId}/init-defaults`);
        const newResponse = await axios.get(`/dojo-banken/${dojoId}`);
        setBanken(newResponse.data);
        if (newResponse.data.length > 0) {
          setActiveTab(newResponse.data[0].id);
          loadBankData(newResponse.data[0]);
        }
      } else {
        setBanken(response.data);
        if (!activeTab && response.data.length > 0) {
          setActiveTab(response.data[0].id);
          loadBankData(response.data[0]);
        } else if (activeTab) {
          const current = response.data.find(b => b.id === activeTab);
          if (current) {
            loadBankData(current);
          }
        }
      }
    } catch (error) {
      console.error('Fehler beim Laden der Banken:', error);
      setMessage('Fehler beim Laden der Banken');
    } finally {
      setLoading(false);
    }
  };

  const loadBankData = (bank) => {
    setFormData({
      bank_name: bank.bank_name || '',
      bank_typ: bank.bank_typ || 'bank',
      ist_aktiv: bank.ist_aktiv || false,
      ist_standard: bank.ist_standard || false,
      iban: bank.iban || '',
      bic: bank.bic || '',
      kontoinhaber: bank.kontoinhaber || '',
      sepa_glaeubiger_id: bank.sepa_glaeubiger_id || '',
      stripe_publishable_key: bank.stripe_publishable_key || '',
      stripe_secret_key: bank.stripe_secret_key || '',
      stripe_account_id: bank.stripe_account_id || '',
      paypal_email: bank.paypal_email || '',
      paypal_client_id: bank.paypal_client_id || '',
      paypal_client_secret: bank.paypal_client_secret || '',
      notizen: bank.notizen || ''
    });
  };

  const handleSaveBank = async () => {
    if (!formData.bank_name) {
      setMessage('Bankname ist erforderlich');
      return;
    }

    try {
      setLoading(true);
      await axios.put(`/dojo-banken/${dojoId}/${activeTab}`, formData);
      setMessage('Bank erfolgreich gespeichert');
      loadBanken();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Speichern:', error);
      setMessage('Fehler beim Speichern der Bank');
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = async () => {
    if (!formData.bank_name) {
      setMessage('Bankname ist erforderlich');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`/dojo-banken/${dojoId}`, {
        ...formData,
        ist_aktiv: true
      });
      setMessage('Bank erfolgreich hinzugefügt');
      setShowNewBankDialog(false);
      await loadBanken();
      setActiveTab(response.data.id);
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Hinzufügen:', error);
      setMessage('Fehler beim Hinzufügen der Bank');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBank = async (bankId) => {
    if (!confirm('Möchten Sie diese Bankverbindung wirklich löschen?')) {
      return;
    }

    try {
      setLoading(true);
      await axios.delete(`/dojo-banken/${dojoId}/${bankId}`);
      setMessage('Bank erfolgreich gelöscht');
      await loadBanken();
      setTimeout(() => setMessage(''), 3000);
    } catch (error) {
      console.error('Fehler beim Löschen:', error);
      setMessage('Fehler beim Löschen der Bank');
    } finally {
      setLoading(false);
    }
  };

  const renderBankIcon = (typ) => {
    switch (typ) {
      case 'stripe':
        return <CreditCard size={16} />;
      case 'paypal':
        return <DollarSign size={16} />;
      default:
        return <DollarSign size={16} />;
    }
  };

  const renderBankForm = () => {
    const currentBank = banken.find(b => b.id === activeTab);
    if (!currentBank) return null;

    return (
      <div className="bank-form">
        {/* Kompaktes Layout: Allgemeine Infos + SEPA + Notizen nebeneinander */}
        <div className="form-section-three-column">
          {/* Allgemeine Informationen - Links */}
          <div className="form-section">
            <h3>Allgemeine Infos</h3>
            
            <div className="form-group">
              <label>Bankname *</label>
              <input
                type="text"
                value={formData.bank_name}
                onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
                placeholder="z.B. Sparkasse Stuttgart"
              />
            </div>

            <div className="form-group">
              <label>Typ</label>
              <select
                value={formData.bank_typ}
                onChange={(e) => setFormData({ ...formData, bank_typ: e.target.value })}
              >
                <option value="bank">Bank / SEPA</option>
                <option value="stripe">Stripe</option>
                <option value="paypal">PayPal</option>
                <option value="sonstige">Sonstige</option>
              </select>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.ist_aktiv}
                  onChange={(e) => setFormData({ ...formData, ist_aktiv: e.target.checked })}
                />
                <span>Aktiv (sichtbar für Mitglieder)</span>
              </label>
            </div>

            <div className="form-group checkbox-group">
              <label>
                <input
                  type="checkbox"
                  checked={formData.ist_standard}
                  onChange={(e) => setFormData({ ...formData, ist_standard: e.target.checked })}
                />
                <span>Standard-Konto</span>
                <Star 
                  size={14} 
                  fill={formData.ist_standard ? '#ffd700' : 'none'}
                  color="#ffd700"
                  style={{ marginLeft: '6px' }}
                />
              </label>
            </div>
          </div>

          {/* SEPA / Bankdaten - Mitte */}
          {formData.bank_typ === 'bank' && (
            <div className="form-section">
              <h3>SEPA / Bankverbindung</h3>
              
              <div className="form-group">
                <label>IBAN</label>
                <input
                  type="text"
                  value={formData.iban}
                  onChange={(e) => setFormData({ ...formData, iban: e.target.value.toUpperCase() })}
                  placeholder="DE89370400440532013000"
                />
              </div>

              <div className="form-group">
                <label>BIC</label>
                <input
                  type="text"
                  value={formData.bic}
                  onChange={(e) => setFormData({ ...formData, bic: e.target.value.toUpperCase() })}
                  placeholder="COBADEFFXXX"
                />
              </div>

              <div className="form-group">
                <label>Kontoinhaber</label>
                <input
                  type="text"
                  value={formData.kontoinhaber}
                  onChange={(e) => setFormData({ ...formData, kontoinhaber: e.target.value })}
                  placeholder="Dojo Name e.V."
                />
              </div>

              <div className="form-group">
                <label>SEPA Gläubiger-ID</label>
                <input
                  type="text"
                  value={formData.sepa_glaeubiger_id}
                  onChange={(e) => setFormData({ ...formData, sepa_glaeubiger_id: e.target.value })}
                  placeholder="DE98ZZZ09999999999"
                />
              </div>
            </div>
          )}

          {/* Notizen - Rechts */}
          <div className="form-section">
            <h3>Notizen</h3>
            <div className="form-group">
              <textarea
                value={formData.notiz}
                onChange={(e) => setFormData({ ...formData, notiz: e.target.value })}
                placeholder="Interne Notizen, Hinweise..."
                rows="6"
              />
            </div>
          </div>
        </div>

        {/* Stripe mit 3-Spalten Layout */}
        {formData.bank_typ === 'stripe' && (
          <div className="form-section-three-column">
            {/* Leere Spalte links für Alignment */}
            <div></div>
            
            {/* Stripe Zugangsdaten - Mitte */}
            <div className="form-section">
              <h3>Stripe Zugangsdaten</h3>
              
              <div className="form-row-compact">
                <div className="form-group">
                  <label>Publishable Key</label>
                  <input
                    type="text"
                    value={formData.stripe_publishable_key}
                    onChange={(e) => setFormData({ ...formData, stripe_publishable_key: e.target.value })}
                    placeholder="pk_live_..."
                  />
                </div>

                <div className="form-group">
                  <label>Secret Key</label>
                  <input
                    type="password"
                    value={formData.stripe_secret_key}
                    onChange={(e) => setFormData({ ...formData, stripe_secret_key: e.target.value })}
                    placeholder="sk_live_..."
                  />
                </div>
              </div>

              <div className="form-row-compact">
                <div className="form-group">
                  <label>Account ID (optional)</label>
                  <input
                    type="text"
                    value={formData.stripe_account_id}
                    onChange={(e) => setFormData({ ...formData, stripe_account_id: e.target.value })}
                    placeholder="acct_..."
                  />
                </div>
              </div>
            </div>

            {/* Notizen - Rechts */}
            <div className="form-section">
              <h3>Notizen</h3>
              <div className="form-group">
                <textarea
                  value={formData.notiz}
                  onChange={(e) => setFormData({ ...formData, notiz: e.target.value })}
                  placeholder="Interne Notizen, Hinweise..."
                  rows="6"
                />
              </div>
            </div>
          </div>
        )}

        {/* PayPal mit 3-Spalten Layout */}
        {formData.bank_typ === 'paypal' && (
          <div className="form-section-three-column">
            {/* Leere Spalte links für Alignment */}
            <div></div>
            
            {/* PayPal Zugangsdaten - Mitte */}
            <div className="form-section">
              <h3>PayPal Zugangsdaten</h3>
              
              <div className="form-row-compact">
                <div className="form-group">
                  <label>PayPal E-Mail</label>
                  <input
                    type="email"
                    value={formData.paypal_email}
                    onChange={(e) => setFormData({ ...formData, paypal_email: e.target.value })}
                    placeholder="business@example.com"
                  />
                </div>

                <div className="form-group">
                  <label>Client ID</label>
                  <input
                    type="text"
                    value={formData.paypal_client_id}
                    onChange={(e) => setFormData({ ...formData, paypal_client_id: e.target.value })}
                    placeholder="PayPal Client ID"
                  />
                </div>
              </div>

              <div className="form-row-compact">
                <div className="form-group">
                  <label>Client Secret</label>
                  <input
                    type="password"
                    value={formData.paypal_client_secret}
                    onChange={(e) => setFormData({ ...formData, paypal_client_secret: e.target.value })}
                    placeholder="PayPal Client Secret"
                  />
                </div>
              </div>
            </div>

            {/* Notizen - Rechts */}
            <div className="form-section">
              <h3>Notizen</h3>
              <div className="form-group">
                <textarea
                  value={formData.notiz}
                  onChange={(e) => setFormData({ ...formData, notiz: e.target.value })}
                  placeholder="Interne Notizen, Hinweise..."
                  rows="6"
                />
              </div>
            </div>
          </div>
        )}


        {/* Aktionsbuttons */}
        <div className="form-actions">
          <button
            onClick={handleSaveBank}
            disabled={loading}
            className="btn btn-primary"
          >
            <Check size={16} />
            Speichern
          </button>

          {banken.length > 2 && (
            <button
              onClick={() => handleDeleteBank(activeTab)}
              disabled={loading}
              className="btn btn-danger"
            >
              <X size={16} />
              Löschen
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bank-tabs-container">
      {message && (
        <div className={`message ${message.includes('Fehler') ? 'error' : 'success'}`}>
          <AlertCircle size={16} />
          {message}
        </div>
      )}

      {/* Tab-Leiste */}
      <div className="tabs-header">
        {banken.map((bank) => (
          <div
            key={bank.id}
            className={`tab ${activeTab === bank.id ? 'active' : ''} ${!bank.ist_aktiv ? 'inactive' : ''}`}
            onClick={() => {
              setActiveTab(bank.id);
              loadBankData(bank);
            }}
          >
            {renderBankIcon(bank.bank_typ)}
            <span>{bank.bank_name}</span>
            {bank.ist_standard && <Star size={14} fill="#ffd700" color="#ffd700" />}
          </div>
        ))}

        <button
          className="tab tab-add"
          onClick={() => {
            setFormData({
              bank_name: '',
              bank_typ: 'bank',
              ist_aktiv: true,
              ist_standard: false,
              iban: '',
              bic: '',
              kontoinhaber: '',
              sepa_glaeubiger_id: '',
              stripe_publishable_key: '',
              stripe_secret_key: '',
              stripe_account_id: '',
              paypal_email: '',
              paypal_client_id: '',
              paypal_client_secret: '',
              notizen: ''
            });
            setShowNewBankDialog(true);
          }}
        >
          <Plus size={16} />
          Neue Bank
        </button>
      </div>

      {/* Tab-Inhalt */}
      <div className="tabs-content">
        {loading ? (
          <div className="loading">Lädt...</div>
        ) : showNewBankDialog ? (
          <div className="bank-form">
            <h2>Neue Bankverbindung hinzufügen</h2>
            {renderBankForm()}
            <div className="form-actions">
              <button onClick={handleAddBank} className="btn btn-primary">
                <Plus size={16} />
                Hinzufügen
              </button>
              <button onClick={() => setShowNewBankDialog(false)} className="btn btn-secondary">
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          renderBankForm()
        )}
      </div>
    </div>
  );
};

export default BankTabs;

