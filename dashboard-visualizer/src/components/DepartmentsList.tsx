import React, { useEffect, useState } from 'react';
import { getDepartments, Department } from '../services/api';
import './DepartmentsList.css';

const DepartmentsList: React.FC = () => {
    const [departments, setDepartments] = useState<Department[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDepartments = async () => {
            try {
                const data = await getDepartments();
                setDepartments(data);
            } catch (err) {
                setError('Error fetching departments');
            } finally {
                setLoading(false);
            }
        };

        fetchDepartments();
    }, []);

    if (loading) {
        return <div>Loading...</div>;
    }

    if (error) {
        return <div>{error}</div>;
    }

    return (
        <div className="departments-container">
            <h1>Departamentos</h1>
            <div className="departments-grid">
                {departments.map((department) => (
                    <div key={department.id_departamento} className="department-card">
                        <h2>{department.nombre_departamento}</h2>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default DepartmentsList;
