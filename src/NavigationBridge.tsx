import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerAssignmentsNavigation, registerExpensesNavigation, registerIdProofNavigation } from './assistantBridge';

export default function NavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    registerExpensesNavigation(() => navigate('/expenses'));
    registerAssignmentsNavigation(() => navigate('/assignments'));
    registerIdProofNavigation((show) => navigate(show ? '/id-proof?show=1' : '/id-proof'));
  }, [navigate]);

  return null;
}
