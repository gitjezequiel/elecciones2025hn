import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Department {
  id_departamento: string;
  nombre_departamento: string;
}

interface Props {
  onSelectDepartment: (departmentId: string) => void;
}

const Departments: React.FC<Props> = ({ onSelectDepartment }) => {
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<string>('');

  useEffect(() => {
    axios.get('http://localhost:3000/api/departamentos')
      .then(response => {
        setDepartments(response.data);
      })
      .catch(error => {
        console.error('Error fetching departments:', error);
      });
  }, []);

  const handleSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const departmentId = event.target.value;
    setSelectedDepartment(departmentId);
    onSelectDepartment(departmentId);
  };

  return (
    <div>
      <h2>Seleccione un Departamento</h2>
      <select value={selectedDepartment} onChange={handleSelection}>
        <option value="">-- Seleccione --</option>
        {departments.map(dep => (
          <option key={dep.id_departamento} value={dep.id_departamento}>
            {dep.nombre_departamento}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Departments;
