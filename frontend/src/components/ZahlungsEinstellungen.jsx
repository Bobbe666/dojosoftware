import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const ZahlungsEinstellungen = () => {
  const navigate = useNavigate();
  useEffect(() => { navigate('/dashboard/integrationen', { replace: true }); }, [navigate]);
  return null;
};

export default ZahlungsEinstellungen;
