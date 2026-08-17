import React, { useEffect, useMemo, useState } from 'react';
import { MdAdd, MdDelete, MdEdit, MdRefresh, MdSecurity } from 'react-icons/md';
import toast from 'react-hot-toast';
import API from '../../../services/api';
import useAdminAuthStore from '../store/adminAuthStore';
import { ADMIN_MENU_GROUPS } from '../constants/adminPermissions';
import AdminTable, {
    AdminTableHead,
    AdminTableHeaderCell,
    AdminTableHeaderRow
} from '../components/common/AdminTable';

const createInitialForm = () => ({
    id: null,
    name: '',
    username: '',
    email: '',
    password: '',
    role: 'subadmin',
    sidebarPermissions: []
});

const AdminManagement = () => {
    const adminUser = useAdminAuthStore((state) => state.adminUser);
    const [admins, setAdmins] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [form, setForm] = useState(createInitialForm());

    const isEditing = Boolean(form.id);
    const isSuperadmin = adminUser?.role === 'superadmin';

    const loadAdmins = async () => {
        setLoading(true);
        try {
            const { data } = await API.get('/admin/manage-admins');
            setAdmins(Array.isArray(data) ? data : []);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load admins');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (isSuperadmin) {
            loadAdmins();
        }
    }, [isSuperadmin]);

    const totalAdmins = admins.length;
    const totalSubadmins = admins.filter((item) => item.role === 'subadmin').length;

    const selectedPermissionLabels = useMemo(() => {
        const labels = [];
        ADMIN_MENU_GROUPS.forEach((group) => {
            group.items.forEach((item) => {
                if (form.sidebarPermissions.includes(item.key)) {
                    labels.push(item.name);
                }
            });
        });
        return labels;
    }, [form.sidebarPermissions]);

    const resetForm = () => {
        setForm(createInitialForm());
    };

    const handlePermissionToggle = (permissionKey) => {
        setForm((current) => ({
            ...current,
            sidebarPermissions: current.sidebarPermissions.includes(permissionKey)
                ? current.sidebarPermissions.filter((item) => item !== permissionKey)
                : [...current.sidebarPermissions, permissionKey]
        }));
    };

    const handleEdit = (adminRecord) => {
        setForm({
            id: adminRecord._id,
            name: adminRecord.name || '',
            username: adminRecord.username || '',
            email: adminRecord.email || '',
            password: '',
            role: adminRecord.role || 'subadmin',
            sidebarPermissions: Array.isArray(adminRecord.sidebarPermissions) ? adminRecord.sidebarPermissions : []
        });
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!form.name.trim() || !form.email.trim()) {
            toast.error('Name and email are required');
            return;
        }

        if (!isEditing && !form.password.trim()) {
            toast.error('Password is required for new admins');
            return;
        }

        if (form.role === 'subadmin' && form.sidebarPermissions.length === 0) {
            toast.error('Select at least one sidebar option for subadmin');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                name: form.name.trim(),
                username: form.username.trim(),
                email: form.email.trim(),
                role: form.role,
                sidebarPermissions: form.role === 'superadmin' ? [] : form.sidebarPermissions,
                ...(form.password.trim() ? { password: form.password.trim() } : {})
            };

            if (isEditing) {
                const { data } = await API.put(`/admin/manage-admins/${form.id}`, payload);
                setAdmins((current) => current.map((item) => (item._id === data._id ? data : item)));
                toast.success('Admin updated successfully');
            } else {
                const { data } = await API.post('/admin/manage-admins', payload);
                setAdmins((current) => [data, ...current]);
                toast.success('Admin created successfully');
            }

            resetForm();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to save admin');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (adminId) => {
        const adminRecord = admins.find((item) => item._id === adminId);
        if (!adminRecord) {
            return;
        }

        if (!window.confirm(`Delete admin account for ${adminRecord.name}?`)) {
            return;
        }

        setDeletingId(adminId);
        try {
            await API.delete(`/admin/manage-admins/${adminId}`);
            setAdmins((current) => current.filter((item) => item._id !== adminId));
            toast.success('Admin deleted successfully');
            if (form.id === adminId) {
                resetForm();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to delete admin');
        } finally {
            setDeletingId(null);
        }
    };

    if (!isSuperadmin) {
        return (
            <div className="rounded-3xl border border-amber-200 bg-amber-50 px-6 py-8 shadow-sm">
                <div className="flex items-start gap-4">
                    <div className="rounded-2xl bg-amber-100 p-3 text-amber-700">
                        <MdSecurity size={24} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-amber-900">Admin Management is restricted</h1>
                        <p className="mt-2 text-sm font-medium text-amber-800">
                            Only superadmins can create other admins, assign roles, or control sidebar access.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-gray-900">Admin Management</h1>
                    <p className="mt-1 text-sm font-medium text-gray-500">
                        Create superadmins or subadmins and control which sidebar modules each subadmin can access.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3 md:flex md:items-center">
                    <div className="rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">Total Admins</p>
                        <p className="mt-1 text-xl font-black text-gray-900">{totalAdmins}</p>
                    </div>
                    <div className="rounded-2xl border border-primary-100 bg-primary-50/80 px-4 py-3 shadow-sm">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary-400">Subadmins</p>
                        <p className="mt-1 text-xl font-black text-primary-700">{totalSubadmins}</p>
                    </div>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">
                            {isEditing ? 'Edit Admin Access' : 'Create New Admin'}
                        </h2>
                        <p className="text-sm font-medium text-gray-500">
                            {isEditing
                                ? 'Update role, login credentials, or sidebar permissions for this admin.'
                                : 'Set email and password for login, then choose the access level.'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        {isEditing && (
                            <button
                                type="button"
                                onClick={resetForm}
                                className="rounded-2xl border border-gray-200 px-4 py-2 text-sm font-bold text-gray-700 transition hover:bg-gray-50"
                            >
                                Cancel Edit
                            </button>
                        )}
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-primary-400"
                        >
                            <MdAdd size={18} />
                            {saving ? 'Saving...' : isEditing ? 'Update Admin' : 'Create Admin'}
                        </button>
                    </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Full Name</span>
                        <input
                            type="text"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary-500 focus:bg-white"
                            placeholder="Admin name"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Username</span>
                        <input
                            type="text"
                            value={form.username}
                            onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary-500 focus:bg-white"
                            placeholder="Optional username"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">Login Email</span>
                        <input
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary-500 focus:bg-white"
                            placeholder="name@example.com"
                        />
                    </label>
                    <label className="block">
                        <span className="mb-2 block text-xs font-black uppercase tracking-[0.16em] text-gray-500">
                            {isEditing ? 'New Password' : 'Password'}
                        </span>
                        <input
                            type="password"
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            className="w-full rounded-2xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-900 outline-none transition focus:border-primary-500 focus:bg-white"
                            placeholder={isEditing ? 'Leave blank to keep current password' : 'Set login password'}
                        />
                    </label>
                </div>

                <div className="mt-6 rounded-3xl border border-gray-200 bg-gray-50/80 p-4 md:p-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <h3 className="text-sm font-black uppercase tracking-[0.16em] text-gray-600">Role & Sidebar Access</h3>
                            <p className="mt-1 text-sm font-medium text-gray-500">
                                Superadmins get every sidebar option automatically. Subadmins only see checked modules.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${form.role === 'superadmin' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="role"
                                    checked={form.role === 'superadmin'}
                                    onChange={() => setForm((current) => ({ ...current, role: 'superadmin', sidebarPermissions: [] }))}
                                />
                                Superadmin
                            </label>
                            <label className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-bold transition ${form.role === 'subadmin' ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-white text-gray-700'}`}>
                                <input
                                    type="radio"
                                    name="role"
                                    checked={form.role === 'subadmin'}
                                    onChange={() => setForm((current) => ({ ...current, role: 'subadmin' }))}
                                />
                                Subadmin
                            </label>
                        </div>
                    </div>

                    {form.role === 'subadmin' ? (
                        <div className="mt-5 space-y-4">
                            {ADMIN_MENU_GROUPS.map((group) => (
                                <div key={group.title} className="rounded-2xl border border-gray-200 bg-white p-4">
                                    <p className="text-xs font-black uppercase tracking-[0.16em] text-gray-500">{group.title}</p>
                                    <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                        {group.items.filter((item) => item.assignable !== false).map((item) => (
                                            <label
                                                key={item.key}
                                                className={`flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition ${form.sidebarPermissions.includes(item.key) ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 bg-gray-50 text-gray-700'}`}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={form.sidebarPermissions.includes(item.key)}
                                                    onChange={() => handlePermissionToggle(item.key)}
                                                />
                                                <span>{item.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            <p className="text-sm font-medium text-gray-500">
                                Selected modules: {selectedPermissionLabels.length > 0 ? selectedPermissionLabels.join(', ') : 'None yet'}
                            </p>
                        </div>
                    ) : (
                        <div className="mt-5 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-4 text-sm font-semibold text-primary-800">
                            This admin will automatically receive every sidebar option, including Admin Management.
                        </div>
                    )}
                </div>
            </form>

            <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <h2 className="text-xl font-black text-gray-900">Existing Admins</h2>
                        <p className="text-sm font-medium text-gray-500">
                            Review who can log in and what level of access each admin currently has.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={loadAdmins}
                        disabled={loading}
                        className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 px-4 py-2.5 text-sm font-bold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        <MdRefresh size={18} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                </div>

                <AdminTable shellClassName="rounded-none border-0 shadow-none" tableClassName="min-w-[980px]">
                    <AdminTableHead>
                        <AdminTableHeaderRow>
                            <AdminTableHeaderCell compact>Admin</AdminTableHeaderCell>
                            <AdminTableHeaderCell compact>Login</AdminTableHeaderCell>
                            <AdminTableHeaderCell compact>Role</AdminTableHeaderCell>
                            <AdminTableHeaderCell compact>Sidebar Access</AdminTableHeaderCell>
                            <AdminTableHeaderCell compact>Last Login</AdminTableHeaderCell>
                            <AdminTableHeaderCell compact className="text-right">Actions</AdminTableHeaderCell>
                        </AdminTableHeaderRow>
                    </AdminTableHead>
                    <tbody className="divide-y divide-gray-200">
                        {loading ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-sm font-medium text-gray-500">
                                    Loading admins...
                                </td>
                            </tr>
                        ) : admins.length === 0 ? (
                            <tr>
                                <td colSpan="6" className="px-6 py-12 text-center text-sm font-medium text-gray-500">
                                    No admins found.
                                </td>
                            </tr>
                        ) : (
                            admins.map((item) => (
                                <tr key={item._id} className="hover:bg-primary-50/30">
                                    <td className="px-5 py-4">
                                        <div>
                                            <p className="font-black text-gray-900">{item.name}</p>
                                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
                                                {item._id === adminUser?._id ? 'Current account' : 'Admin account'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                                        <div className="space-y-1">
                                            <p>{item.email}</p>
                                            <p className="text-xs text-gray-400">{item.username || 'No username set'}</p>
                                        </div>
                                    </td>
                                    <td className="px-5 py-4">
                                        <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] ${item.role === 'superadmin' ? 'bg-emerald-50 text-emerald-700' : 'bg-primary-50 text-primary-700'}`}>
                                            {item.role}
                                        </span>
                                    </td>
                                    <td className="px-5 py-4 text-sm font-semibold text-gray-700">
                                        {item.role === 'superadmin'
                                            ? 'All sidebar options'
                                            : `${item.sidebarPermissions?.length || 0} selected modules`}
                                    </td>
                                    <td className="px-5 py-4 text-sm font-semibold text-gray-600">
                                        {item.lastLogin
                                            ? new Date(item.lastLogin).toLocaleString('en-IN', {
                                                day: '2-digit',
                                                month: 'short',
                                                year: 'numeric',
                                                hour: '2-digit',
                                                minute: '2-digit'
                                            })
                                            : 'Never'}
                                    </td>
                                    <td className="px-5 py-4">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                type="button"
                                                onClick={() => handleEdit(item)}
                                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:border-primary-200 hover:bg-primary-50 hover:text-primary-700"
                                                title="Edit admin"
                                            >
                                                <MdEdit size={18} />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(item._id)}
                                                disabled={deletingId === item._id || item._id === adminUser?._id}
                                                className="rounded-xl border border-gray-200 p-2 text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-40"
                                                title="Delete admin"
                                            >
                                                <MdDelete size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </AdminTable>
            </div>
        </div>
    );
};

export default AdminManagement;
