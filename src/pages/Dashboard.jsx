import { useAuth } from "../contexts/AuthContext";
import { auth } from "../firebase";

export default function Dashboard() {
    const { userProfile } = useAuth();

    return (
        <div style={{ padding: '20px' }}>
            <h1>Dashboard</h1>
            <p>Welcome, {userProfile?.name || userProfile?.email || 'User'}!</p>
            <button onClick={() => auth.signOut()}>Sign Out</button>
        </div>
    );
}
