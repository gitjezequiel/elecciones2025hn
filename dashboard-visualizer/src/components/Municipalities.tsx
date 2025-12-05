import React, { useEffect, useState } from 'react';
import axios from 'axios';

interface Municipality {
  id_municipio: string;
  nombre_municipio: string;
}

interface Props {
  departmentId: string;
  onSelectMunicipality: (municipalityId: string) => void;
}

const Municipalities: React.FC<Props> = ({ departmentId, onSelectMunicipality }) => {
  const [municipalities, setMunicipalities] = useState<Municipality[]>([]);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('');

  useEffect(() => {
    if (departmentId) {
      axios.get(`http://localhost:3000/api/municipios/${departmentId}`)
        .then(response => {
          setMunicipalities(response.data);
          setSelectedMunicipality('');
        })
        .catch(error => {
          console.error('Error fetching municipalities:', error);
        });
    } else {
      setMunicipalities([]);
    }
  }, [departmentId]);

  const handleSelection = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const municipalityId = event.target.value;
    setSelectedMunicipality(municipalityId);
    onSelectMunicipality(municipalityId);
  };

  if (!departmentId) {
    return null;
  }

  return (
    <div>
      <h2>Seleccione un Municipio</h2>
      <select value={selectedMunicipality} onChange={handleSelection}>
        <option value="">-- Seleccione --</option>
        {municipalities.map(mun => (
          <option key={mun.id_municipio} value={mun.id_municipio}>
            {mun.nombre_municipio}
          </option>
        ))}
      </select>
    </div>
  );
};

export default Municipalities;
