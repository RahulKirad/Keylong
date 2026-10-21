import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerAssignmentsNavigation, registerExpensesNavigation } from './assistantBridge';

export default function NavigationBridge() {
  const navigate = useNavigate();

  useEffect(() => {
    registerExpensesNavigation(() => navigate('/expenses'));
    registerAssignmentsNavigation(() => navigate('/assignments'));
  }, [navigate]);

  return null;
}
