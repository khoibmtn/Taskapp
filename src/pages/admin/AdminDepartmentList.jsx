import { useEffect, useState } from "react";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { db } from "../../firebase";
import { Link, useNavigate } from "react-router-dom";

export default function AdminDepartmentList() {
    const navigate = useNavigate();
    const [departments, setDepartments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchDepts() {
            try {
                // Try to sort by name or createAt if index exists, but client sort is safer for now based on previous experience
                const q = collection(db, "departments");
                const snapshot = await getDocs(q);

                const fetched = [];
                snapshot.forEach(doc => {
                    fetched.push({ id: doc.id, ...doc.data() });
                });

                // Client-side sort by name
                fetched.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

                setDepartments(fetched);
            } catch (err) {
                console.error("Error fetching departments:", err);
            } finally {
                setLoading(false);
            }
        }
        fetchDepts();
    }, []);

    return (
        <div style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h2 style={{ margin: 0 }}>Quản lý Khoa / Phòng</h2>
                <Link
                    to="/admin/departments/new"
                    style={{
                        background: '#1976d2',
                        color: 'white',
                        padding: '10px 20px',
                        textDecoration: 'none',
                        borderRadius: '4px',
                        fontWeight: 'bold'
                    }}
                >
                    + Thêm Khoa/Phòng
                </Link>
            </div>

            {loading ? <p>Đang tải dữ liệu...</p> : (
                <div style={{ overflowX: 'auto', background: '#fff', borderRadius: '4px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ background: '#f5f5f5', textAlign: 'left' }}>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Tên đơn vị</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Phân loại</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Trạng thái</th>
                                <th style={{ padding: '12px', borderBottom: '1px solid #ddd' }}>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            {departments.length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ padding: '20px', textAlign: 'center' }}>Chưa có dữ liệu.</td>
                                </tr>
                            ) : (
                                departments.map(d => (
                                    <tr key={d.id} style={{ borderBottom: '1px solid #eee' }}>
                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{d.name}</td>
                                        <td style={{ padding: '12px' }}>
                                            {d.type === 'khoa' ? 'Khoa' : 'Phòng'}
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            {d.isActive ?
                                                <span style={{ color: 'green', background: '#e8f5e9', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9em' }}>Đang hoạt động</span> :
                                                <span style={{ color: 'red', background: '#ffebee', padding: '4px 8px', borderRadius: '4px', fontSize: '0.9em' }}>Ngừng hoạt động</span>
                                            }
                                        </td>
                                        <td style={{ padding: '12px' }}>
                                            <button
                                                onClick={() => navigate(`/admin/departments/${d.id}`)}
                                                style={{
                                                    padding: '5px 10px',
                                                    background: '#fff',
                                                    border: '1px solid #ccc',
                                                    borderRadius: '4px',
                                                    cursor: 'pointer',
                                                    color: '#333'
                                                }}
                                            >
                                                Sửa / Cập nhật
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
