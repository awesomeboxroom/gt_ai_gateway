import request from '../utils/request';
import type { User, CreateUserRequest, UpdateUserRequest } from '../types/user';

export async function listUsers(params?: any): Promise<User[]> {
    return request.get('/user/list.json', { params });
}

export async function fetchUsersByIds(ids: number[]): Promise<User[]> {
    return request.post('/user/batch.json', { ids });
}

export async function getUser(id: number): Promise<User> {
    return request.get(`/user/${id}`);
}

export async function createUser(data: CreateUserRequest): Promise<User> {
    return request.post('/user/create.json', data);
}

export async function updateUser(id: number, data: UpdateUserRequest): Promise<User> {
    return request.put(`/user/${id}`, data);
}
