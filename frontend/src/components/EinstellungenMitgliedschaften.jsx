import React, { useState, useEffect } from "react";
import "../styles/EinstellungenMitgliedschaften.css";
import {
  Table,
  Button,
  Modal,
  Input,
  Select,
  Checkbox,
  Toggle
} from "../components/DesignSystem";

const billingOptions = [
  { value: "MONTHLY", label: "Monatlich" },
  { value: "QUARTERLY", label: "Quartalsweise" },
  { value: "YEARLY", label: "Jährlich" },
];

const paymentMethods = [
  { value: "SEPA", label: "SEPA-Lastschrift" },
  { value: "CARD", label: "Kreditkarte" },
  { value: "PAYPAL", label: "PayPal" },
  { value: "BANK_TRANSFER", label: "Überweisung" },
];

const EinstellungenMitgliedschaften = () => {
  const [tarife, setTarife] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [current, setCurrent] = useState(null); // dto für neuen/zu bearbeitenden Tarif

  useEffect(() => {
    fetch("/api/tarife")
      .then(r => r.json())
      .then(setTarife);
  }, []);

  const openNew = () => {
    setCurrent({
      name: "",
      price_cents: 0,
      currency: "EUR",
      duration_months: 1,
      billing_cycle: "MONTHLY",
      payment_method: [],
      active: true
    });
    setShowModal(true);
  };

  const openEdit = (t) => {
    setCurrent({ ...t });
    setShowModal(true);
  };

  const save = () => {
    const method = current.id ? "PUT" : "POST";
    const url = current.id ? `/api/tarife/${current.id}` : "/api/tarife";
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(current)
    })
      .then(r => r.json())
      .then(newOrUpdated => {
        setTarife(ts => {
          if (method === "PUT")
            return ts.map(t => t.id === newOrUpdated.id ? newOrUpdated : t);
          return [...ts, newOrUpdated];
        });
        setShowModal(false);
      });
  };

  const remove = (id) => {
    if (!window.confirm("Tarif wirklich löschen?")) return;
    fetch(`/api/tarife/${id}`, { method: "DELETE" })
      .then(() => setTarife(ts => ts.filter(t => t.id !== id)));
  };

  return (
    <div className="mitgliedschaften-page">
      <div className="header">
        <h1>Mitgliedschaften & Tarife</h1>
        <Button onClick={openNew}>Neuen Tarif anlegen</Button>
      </div>

      <Table>
        <thead>
          <tr>
            <th>Name</th><th>Preis</th><th>Laufzeit</th>
            <th>Zyklus</th><th>Zahlung</th><th>Aktiv</th><th>Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {tarife.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{(t.price_cents/100).toFixed(2)} {t.currency}</td>
              <td>{t.duration_months} Monat(e)</td>
              <td>{billingOptions.find(o => o.value===t.billing_cycle).label}</td>
              <td>{t.payment_method.join(", ")}</td>
              <td>
                <Toggle 
                  checked={t.active} 
                  onChange={checked => {
                    fetch(`/api/tarife/${t.id}/active`, {
                      method: "PATCH",
                      body: JSON.stringify({ active: checked })
                    }).then(() => setTarife(ts => 
                      ts.map(x => x.id===t.id ? { ...x, active: checked } : x)
                    ));
                  }} 
                />
              </td>
              <td>
                <Button small onClick={() => openEdit(t)}>✏️</Button>
                <Button small danger onClick={() => remove(t.id)}>🗑️</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {showModal && (
        <Modal onClose={() => setShowModal(false)} title={ current.id ? "Tarif bearbeiten" : "Neuen Tarif" }>
          <Input
            label="Name"
            value={current.name}
            onChange={v => setCurrent(c => ({ ...c, name: v }))}
          />
          <Input
            label="Preis (€)"
            type="number"
            value={(current.price_cents/100).toFixed(2)}
            onChange={v => setCurrent(c => ({ ...c, price_cents: Math.round(v*100) }))}
          />
          <Select
            label="Abrechnungszyklus"
            options={billingOptions}
            value={current.billing_cycle}
            onChange={val => setCurrent(c => ({ ...c, billing_cycle: val }))}
          />
          <Checkbox.Group
            label="Zahlungsmethoden"
            options={paymentMethods}
            value={current.payment_method}
            onChange={vals => setCurrent(c => ({ ...c, payment_method: vals }))}
          />
          <Toggle
            label="Aktiv"
            checked={current.active}
            onChange={checked => setCurrent(c => ({ ...c, active: checked }))}
          />
          <div className="modal-actions">
            <Button onClick={save} primary>Speichern</Button>
            <Button onClick={() => setShowModal(false)}>Abbrechen</Button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default EinstellungenMitgliedschaften;
