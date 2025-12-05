import axios from 'axios';

const API_URL = 'http://localhost:3000/api';

export interface Department {
    id_departamento: string;
    nombre_departamento: string;
}

export const getDepartments = async (): Promise<Department[]> => {
    const response = await axios.get(`${API_URL}/departamentos`);
    return response.data;
};
