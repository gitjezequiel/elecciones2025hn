import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';

interface Result {
  candidato_nombres: string;
  partido_nombre: string;
  votos_nuevos: number;
  partido_color: string;
}

interface Props {
  departmentId: string;
  departmentName: string;
  municipalityId: string;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="custom-tooltip" style={{ backgroundColor: 'rgba(44, 62, 80, 0.8)', padding: '10px', border: '1px solid #34495e', color: '#ecf0f1' }}>
        <p className="label">{`${label}`}</p>
        <p className="intro">{`Partido: ${payload[0].payload.partido_nombre}`}</p>
        <p className="desc">{`Votos: ${payload[0].value}`}</p>
      </div>
    );
  }

  return null;
};

const ResultsChart: React.FC<Props> = ({ departmentId, departmentName, municipalityId }) => {
  const [results, setResults] = useState<Result[]>([]);

  useEffect(() => {
    let url = '';
    if (departmentId && municipalityId) {
      url = `http://localhost:3000/api/resultados/municipio/${departmentId}/${municipalityId}`;
    } else if (departmentId) {
      url = `http://localhost:3000/api/resultados/departamento/${departmentId}`;
    } else {
      setResults([]);
      return;
    }

    axios.get(url)
      .then(response => {
        setResults(response.data);
      })
      .catch(error => {
        console.error('Error fetching results:', error);
      });
  }, [departmentId, municipalityId]);

  if (!departmentId) {
    return <div style={{ color: '#ecf0f1', marginTop: '20px' }}>Por favor seleccione un departamento para ver los resultados.</div>;
  }

  if (results.length === 0) {
    return <div style={{ color: '#ecf0f1', marginTop: '20px' }}>No hay resultados para mostrar.</div>;
  }

  return (
    <div style={{ width: '100%' }}>
      <h2 style={{ color: '#3498db' }}>{departmentName}</h2>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={results} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(236, 240, 241, 0.1)" />
          <XAxis dataKey="candidato_nombres" stroke="#ecf0f1" tick={{ angle: -45, textAnchor: 'end' }} height={100} />
          <YAxis stroke="#ecf0f1" />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ color: '#ecf0f1' }} />
          <Bar dataKey="votos_nuevos" name="Votos">
            {results.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.partido_color || '#3498db'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResultsChart;
