import { useNavigate, useParams } from 'react-router-dom';
import { ErrorBoundary } from '../../components/routes/ErrorBoundary';
import { RoomInfoPanel } from './RoomInfoPanel';

function RoomInfo() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <ErrorBoundary>
      <RoomInfoPanel id={id ?? ''} onClose={() => navigate(-1)} />
    </ErrorBoundary>
  )
}

export default RoomInfo
