import { useEffect, useState } from "react";
import { collection, query, where, updateDoc, doc, serverTimestamp, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../contexts/AuthContext";

export default function PersonnelManagement() {
    const { userProfile, currentUser } = useAuth();
    const [deptUsers, setDeptUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    // User Map for resolving names in "Approved By" etc.
    const [userMap, setUserMap] = useState({});

    const ROLE_LABELS = {
        admin: "Quản trị viên",
        manager: "Trưởng khoa/phòng",
        asigner: "Giao việc",
        staff: "Nhân viên"
    };

    const STATUS_LABELS = {
        active: "Đang hoạt động",
        pending: "Chờ duyệt",
        reject_request: "Chờ Admin từ chối",
        delete_request: "Chờ Admin xóa",
        rejected: "Bị từ chối",
        inactive: "Ngừng hoạt động"
    };

    useEffect(() => {
        if (!userProfile?.selectedDepartmentId) {
            setLoading(false);
            return;
        }

        const deptId = userProfile.selectedDepartmentId;
        const usersRef = collection(db, "users");

        setLoading(true);

        // 1. Listen for Personnel
        const unsubNew = onSnapshot(query(usersRef, where("departmentIds", "array-contains", deptId)), (snapNew) => {
            const rawUsers = [];
            snapNew.forEach(doc => rawUsers.push({ id: doc.id, ...doc.data() }));

            setDeptUsers(prev => {
                const combined = [...rawUsers];
                // Hide both rejected and inactive users from Manager view
                return combined.filter(u => u.status !== 'rejected' && u.status !== 'inactive');
            });

            // Update map for local resolution if needed
            setUserMap(prev => {
                const next = { ...prev };
                snapNew.forEach(doc => { next[doc.id] = doc.data(); });
                return next;
            });
            setLoading(false);
        });

        return () => {
            unsubNew();
        };
    }, [userProfile?.selectedDepartmentId]);

    const handleUserStatusUpdate = async (targetUid, newStatus) => {
        try {
            const updates = { status: newStatus };
            if (newStatus === 'active') {
                updates.approvedAt = serverTimestamp();
                updates.approvedBy = currentUser.uid;
            }
            await updateDoc(doc(db, "users", targetUid), updates);
            alert("Cập nhật thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const handleRoleUpdate = async (targetUid, newRole) => {
        try {
            await updateDoc(doc(db, "users", targetUid), { role: newRole });
            alert("Cập nhật quyền thành công!");
        } catch (err) {
            console.error(err);
            alert("Lỗi: " + err.message);
        }
    };

    const getUserName = (uid) => {
        const u = userMap[uid]; // This might be limited to dept users only with current query. 
        // For full name resolution we might need global user query but let's stick to dept users for now or passed down props if needed.
        // Actually ManagementDashboard had a wider query. Let's replicate strict dept scope first.
        if (!u) return uid;
        return u.fullName || (u.email && !u.email.endsWith('@task.app') ? u.email : null) || uid.substring(0, 8);
    };

    const isManagerOrAdmin = userProfile?.role === 'manager' || userProfile?.role === 'admin';

    if (loading) return <div>Đang tải dữ liệu nhân sự...</div>;
    if (!userProfile?.selectedDepartmentId) return <div>Vui lòng chọn hoặc được gán vào 1 khoa/phòng để xem.</div>;

    return (
        <div>
            <h2 style={{ marginBottom: '20px' }}>Quản lý Nhân sự</h2>
            <div style={{ background: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid #ddd' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ background: '#f5f5f5', textAlign: 'left' }}>
                        <tr>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Họ tên</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Quyền</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd' }}>Trạng thái</th>
                            <th style={{ padding: '12px', borderBottom: '2px solid #ddd', textAlign: 'right' }}>Hành động</th>
                        </tr>
                    </thead>
                    <tbody>
                        {deptUsers.map(u => (
                            <tr key={u.id} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '12px' }}>
                                    <div style={{ fontWeight: 'bold' }}>{u.fullName}</div>
                                    <div style={{ fontSize: '0.8em', color: '#666' }}>{u.phone}</div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                    {(u.status === 'active' && isManagerOrAdmin && u.role !== 'admin' && u.role !== 'manager') ? (
                                        <select
                                            value={u.role || 'staff'}
                                            onChange={(e) => handleRoleUpdate(u.id, e.target.value)}
                                            style={{ padding: '4px', borderRadius: '4px', border: '1px solid #ccc' }}
                                        >
                                            <option value="staff">Nhân viên</option>
                                            <option value="asigner">Giao việc</option>
                                        </select>
                                    ) : (
                                        <span style={{ fontSize: '0.9em' }}>
                                            {ROLE_LABELS[u.role] || u.role}
                                        </span>
                                    )}
                                </td>
                                <td style={{ padding: '12px' }}>
                                    <span style={{
                                        padding: '4px 8px', borderRadius: '12px', fontSize: '0.8em',
                                        background: u.status === 'active' ? '#e8f5e9' : (u.status === 'pending' || u.status === 'reject_request') ? '#fff3e0' : u.status === 'delete_request' ? '#ffebee' : '#f5f5f5',
                                        color: u.status === 'active' ? '#2e7d32' : (u.status === 'pending' || u.status === 'reject_request') ? '#ef6c00' : u.status === 'delete_request' ? '#d32f2f' : '#666'
                                    }}>
                                        {STATUS_LABELS[u.status] || u.status}
                                    </span>
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right' }}>
                                    <button
                                        onClick={() => setSelectedUser(u)}
                                        style={{ padding: '5px 10px', background: '#f5f5f5', color: '#333', border: '1px solid #ccc', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                                    >
                                        Xem
                                    </button>

                                    {u.status === 'pending' && (
                                        <>
                                            <button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#2e7d32', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}>Duyệt</button>
                                            <button
                                                onClick={() => {
                                                    if (window.confirm(`Yêu cầu từ chối nhân viên ${u.fullName}?`)) {
                                                        handleUserStatusUpdate(u.id, 'reject_request');
                                                    }
                                                }}
                                                style={{ padding: '5px 10px', background: '#c62828', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', marginRight: '5px' }}
                                            >
                                                Từ chối
                                            </button>
                                        </>
                                    )}

                                    {u.status === 'reject_request' && (
                                        <button onClick={() => handleUserStatusUpdate(u.id, 'pending')} style={{ padding: '5px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy YC Từ chối</button>
                                    )}

                                    {u.status === 'active' && u.id !== currentUser.uid && u.role !== 'admin' && (
                                        <button
                                            onClick={() => {
                                                if (window.confirm(`Gửi yêu cầu xóa nhân viên ${u.fullName}?`)) {
                                                    handleUserStatusUpdate(u.id, 'delete_request');
                                                }
                                            }}
                                            style={{ padding: '5px 10px', background: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                        >
                                            Xóa
                                        </button>
                                    )}
                                    {u.status === 'delete_request' && (
                                        <button onClick={() => handleUserStatusUpdate(u.id, 'active')} style={{ padding: '5px 10px', background: '#757575', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Hủy YC Xóa</button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* User Detail Modal */}
            {selectedUser && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
                    <div style={{ background: '#fff', padding: '30px', borderRadius: '8px', maxWidth: '500px', width: '90%', boxShadow: '0 4px 20px rgba(0,0,0,0.15)' }}>
                        <h3 style={{ marginTop: 0, borderBottom: '1px solid #eee', paddingBottom: '10px' }}>Chi tiết nhân sự</h3>
                        <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr', gap: '10px', marginTop: '20px' }}>
                            <div style={{ fontWeight: 'bold' }}>Họ tên:</div>
                            <div>{selectedUser.fullName}</div>

                            <div style={{ fontWeight: 'bold' }}>Số điện thoại:</div>
                            <div>{selectedUser.phone}</div>

                            <div style={{ fontWeight: 'bold' }}>Email:</div>
                            <div>{selectedUser.email || ''}</div>

                            <div style={{ fontWeight: 'bold' }}>Vị trí:</div>
                            <div>{selectedUser.position}</div>

                            <div style={{ fontWeight: 'bold' }}>Quyền hạn:</div>
                            <div>{ROLE_LABELS[selectedUser.role] || selectedUser.role}</div>

                            <div style={{ fontWeight: 'bold' }}>Trạng thái:</div>
                            <div>{STATUS_LABELS[selectedUser.status] || selectedUser.status}</div>

                            <div style={{ fontWeight: 'bold' }}>Ngày tham gia:</div>
                            <div>{selectedUser.createdAt?.toDate ? selectedUser.createdAt.toDate().toLocaleDateString('vi-VN') : 'N/A'}</div>

                            {selectedUser.status !== 'pending' && (
                                <>
                                    <div style={{ fontWeight: 'bold' }}>Duyệt bởi:</div>
                                    <div>{getUserName(selectedUser.approvedBy) || 'N/A'}</div>
                                </>
                            )}
                        </div>
                        <div style={{ marginTop: '30px', textAlign: 'right' }}>
                            <button
                                onClick={() => setSelectedUser(null)}
                                style={{ padding: '8px 20px', background: '#1976d2', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                            >
                                Đóng
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
