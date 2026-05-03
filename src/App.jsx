import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Printer, User, Building, Calendar, FileText, CheckCircle2, Users, Settings, LogOut, Lock, UserPlus, History, Save, Link as LinkIcon, BookOpen, Copy, ExternalLink, MessageSquare, Loader2, Database } from 'lucide-react';

// ================= SUPABASE INITIALIZATION =================
// PENTING: SAAT ANDA MENYALIN KODE INI KE VS CODE LOKAL ANDA, 
// HAPUS TANDA KOMENTAR (//) PADA BARIS IMPORT DI BAWAH INI AGAR DATABASE BERFUNGSI:
// import { createClient } from '@supabase/supabase-js';

// Hapus /rest/v1/ di belakangnya
const supabaseUrl = 'https://atltvczwtnzptwguqznm.supabase.co';

// Key Anda sudah benar
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0bHR2Y3p3dG56cHR3Z3Vxem5tIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4MDk1NjEsImV4cCI6MjA5MzM4NTU2MX0.mSF-NcpzAsy0rlES0_7UpAZTi4tyoO4JHapPobxsGEs';

let supabase = null;
try {
  // Pengaman: Hanya memuat Supabase jika URL valid (berawalan http)
  if (supabaseUrl.startsWith('http')) {
    // Fungsi ini akan otomatis menggunakan createClient dari import VS Code Anda nantinya
    const initClient = typeof createClient !== 'undefined' ? createClient : () => null;
    supabase = initClient(supabaseUrl, supabaseAnonKey);
  }
} catch (error) {
  console.error("Gagal memuat koneksi Supabase:", error);
}

export default function App() {
  // ================= APP & SUPABASE STATE =================
  const [isDbReady, setIsDbReady] = useState(false);
  const [dbError, setDbError] = useState(false);

  const [appUsers, setAppUsers] = useState([]); 
  const [invoices, setInvoices] = useState([]); 
  const [bookings, setBookings] = useState([]); 
  
  const [editingInvoice, setEditingInvoice] = useState(null); 
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState('generator'); 

  // Simulasi URL Publik
  const [publicVendorId, setPublicVendorId] = useState(null); 
  const [publicFormSuccess, setPublicFormSuccess] = useState(false);

  // Toast Notification State
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  const showToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'success' }), 3000);
  };

  // ================= 1. SUPABASE DATA FETCHING =================
  const fetchAllData = async () => {
    try {
      // Cek apakah koneksi valid
      if (!supabase) {
        setDbError(true);
        setIsDbReady(true);
        return;
      }

      // Fetch Users
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) throw usersError;
      setAppUsers(usersData);

      // Fetch Invoices beserta relasi Items
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select(`*, invoice_items(*)`)
        .order('created_at', { ascending: false });
      if (invoicesError) throw invoicesError;
      
      const mappedInvoices = invoicesData.map(inv => ({
        id: inv.id,
        userId: inv.user_id,
        sourceBookingId: inv.source_booking_id,
        createdAt: inv.created_at,
        vendor: { name: inv.vendor_name, phone: inv.vendor_phone, email: inv.vendor_email, instagram: inv.vendor_instagram, bank: inv.vendor_bank },
        client: { bride: inv.client_bride, groom: inv.client_groom, phone: inv.client_phone, address: inv.client_address },
        event: { date: inv.event_date, time: inv.event_time, venue: inv.event_venue },
        items: inv.invoice_items.map(item => ({ id: item.id, name: item.item_name, desc: item.item_description, price: item.price })),
        dpAmount: inv.dp_amount,
        terms: inv.terms
      }));
      setInvoices(mappedInvoices);

      // Fetch Bookings
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false });
      if (bookingsError) throw bookingsError;
      
      const mappedBookings = bookingsData.map(b => ({
        id: b.id,
        vendorId: b.vendor_id,
        bride: b.bride_name,
        groom: b.groom_name,
        phone: b.phone,
        address: b.address,
        date: b.event_date,
        time: b.event_time,
        venue: b.venue,
        packageInterest: b.package_interest,
        notes: b.notes,
        status: b.status,
        createdAt: b.created_at
      }));
      setBookings(mappedBookings);

      setIsDbReady(true);
      setDbError(false); // Reset error jika sukses
    } catch (error) {
      console.error("Supabase Fetch Error:", error);
      setDbError(true);
      setIsDbReady(true);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, [currentUser]); 

  // ================= APP LOGIN HANDLERS =================
  const handleLogin = async (e) => {
    e.preventDefault();
    const u = e.target.username.value;
    const p = e.target.password.value;
    
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('username', u)
        .eq('password_hash', p)
        .single();
      
      if (data) {
        setCurrentUser(data);
        setActiveTab('generator');
        showToast(`Selamat datang, ${data.username}!`, 'success');
        fetchAllData();
      } else {
        showToast('Username atau password salah!', 'error');
      }
    } catch (error) {
      showToast('Terjadi kesalahan saat login (Pastikan akun ada di database)', 'error');
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setEditingInvoice(null);
    setActiveTab('generator');
  };

  // ================= SUPABASE CRUD HANDLERS =================
  const handleSaveInvoice = async (invoiceData) => {
    if (!currentUser || !supabase) return;
    try {
      let currentInvoiceId = invoiceData.id;
      const isEditing = invoices.some(inv => inv.id === currentInvoiceId);

      const invoicePayload = {
        user_id: currentUser.id,
        source_booking_id: invoiceData.sourceBookingId || null,
        vendor_name: invoiceData.vendor.name,
        vendor_phone: invoiceData.vendor.phone,
        vendor_email: invoiceData.vendor.email,
        vendor_instagram: invoiceData.vendor.instagram,
        vendor_bank: invoiceData.vendor.bank,
        client_bride: invoiceData.client.bride,
        client_groom: invoiceData.client.groom,
        client_phone: invoiceData.client.phone,
        client_address: invoiceData.client.address,
        event_date: invoiceData.event.date,
        event_time: invoiceData.event.time,
        event_venue: invoiceData.event.venue,
        dp_amount: invoiceData.dpAmount,
        terms: invoiceData.terms
      };

      if (isEditing) {
        await supabase.from('invoices').update(invoicePayload).eq('id', currentInvoiceId);
        await supabase.from('invoice_items').delete().eq('invoice_id', currentInvoiceId);
      } else {
        const { data, error } = await supabase.from('invoices').insert(invoicePayload).select().single();
        if (error) throw error;
        currentInvoiceId = data.id; 
      }

      if (invoiceData.items && invoiceData.items.length > 0) {
        const itemsPayload = invoiceData.items.map(item => ({
          invoice_id: currentInvoiceId,
          item_name: item.name,
          item_description: item.desc,
          price: item.price
        }));
        await supabase.from('invoice_items').insert(itemsPayload);
      }
      
      if (invoiceData.sourceBookingId) {
        await supabase.from('bookings').update({ status: 'invoiced' }).eq('id', invoiceData.sourceBookingId);
      }

      await fetchAllData();
      showToast('Invoice berhasil disimpan ke Database!', 'success');
      
    } catch (err) {
      console.error(err);
      showToast('Gagal menyimpan invoice', 'error');
    }
  };

  const handleCreateInvoiceFromBooking = (booking) => {
    setEditingInvoice({
      id: null,
      sourceBookingId: booking.id, 
      createdAt: new Date().toISOString(),
      vendor: { name: '', phone: '', email: '', instagram: '', bank: '' }, 
      client: {
        bride: booking.bride,
        groom: booking.groom,
        phone: booking.phone,
        address: booking.address
      },
      event: { date: booking.date, time: booking.time, venue: booking.venue },
      items: [{ id: 1, name: booking.packageInterest || '', desc: booking.notes ? `Catatan Klien: ${booking.notes}` : '', price: 0 }],
      dpAmount: 0,
      terms: "1. Pembayaran Uang Muka (DP) tidak dapat dikembalikan apabila terjadi pembatalan sepihak oleh klien.\n2. Pelunasan sisa pembayaran wajib diselesaikan selambat-lambatnya H-7 sebelum hari pelaksanaan acara.\n3. Vendor tidak bertanggung jawab atas kegagalan teknis di luar kendali (force majeure) seperti bencana alam.\n4. Waktu penyelesaian editing foto & video adalah maksimal 60 hari kerja setelah hari H acara.\n5. Klien berhak mendapatkan maksimal 2 (dua) kali revisi untuk video cinematic."
    });
    setActiveTab('generator');
    showToast('Data booking berhasil dimasukkan ke form!', 'success');
  };

  const handleEditInvoice = (invoice) => { setEditingInvoice(invoice); setActiveTab('generator'); };
  const handleNewInvoice = () => { setEditingInvoice(null); setActiveTab('generator'); };

  // Owner Handlers (Manage Users)
  const handleAddUser = async (e) => {
    e.preventDefault();
    const newUsername = e.target.newUsername.value;
    const newPassword = e.target.newPassword.value;
    
    try {
      const { error } = await supabase.from('users').insert({
        username: newUsername,
        password_hash: newPassword,
        role: 'client'
      });
      if (error) throw error;
      
      e.target.reset();
      showToast('Akun client berhasil ditambahkan!', 'success');
      fetchAllData();
    } catch (err) {
      showToast('Gagal menambah akun (mungkin username duplikat)', 'error');
    }
  };

  const handleDeleteUser = async (id) => {
    try {
      await supabase.from('users').delete().eq('id', id);
      setConfirmDeleteId(null);
      showToast('Akun berhasil dihapus!', 'success');
      fetchAllData();
    } catch (err) {
      showToast('Gagal menghapus akun', 'error');
    }
  };

  // Client Handlers
  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    const updatedUsername = e.target.updateUsername.value;
    const updatedPassword = e.target.updatePassword.value;

    try {
      const updatePayload = { username: updatedUsername };
      if (updatedPassword) updatePayload.password_hash = updatedPassword;

      await supabase.from('users').update(updatePayload).eq('id', currentUser.id);
      
      setCurrentUser({ ...currentUser, ...updatePayload });
      showToast('Profil berhasil diperbarui!', 'success');
      fetchAllData();
    } catch (err) {
      showToast('Gagal memperbarui profil', 'error');
    }
  };

  // Public Booking Handlers
  const handleSubmitPublicBooking = async (e) => {
    e.preventDefault();
    
    const newBooking = {
      vendor_id: publicVendorId,
      bride_name: e.target.bride.value,
      groom_name: e.target.groom.value,
      phone: e.target.phone.value,
      address: e.target.address.value,
      event_date: e.target.date.value,
      event_time: e.target.time.value,
      venue: e.target.venue.value,
      package_interest: e.target.packageInterest.value,
      notes: e.target.notes.value,
      status: 'pending' 
    };
    
    try {
      if (supabase) {
        await supabase.from('bookings').insert(newBooking);
      }
      setPublicFormSuccess(true);
      fetchAllData();
    } catch (err) {
      showToast('Gagal mengirim form', 'error');
    }
  };

  const copyBookingLink = () => {
    const dummyLink = `${window.location.origin}/book/${currentUser.id}`;
    navigator.clipboard.writeText(dummyLink).catch(() => {
        const tempInput = document.createElement("input");
        tempInput.value = dummyLink;
        document.body.appendChild(tempInput);
        tempInput.select();
        document.execCommand("copy");
        document.body.removeChild(tempInput);
    });
    showToast('Link Booking berhasil disalin!', 'success');
  };

  // ================= RENDER VIEWS =================

  // LOADING & ERROR STATE
  if (!isDbReady) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <Loader2 size={40} className="text-slate-900 animate-spin mb-4" />
        <h2 className="text-lg font-medium text-slate-700">Menghubungkan ke Database...</h2>
      </div>
    );
  }

  if (dbError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-6 text-center">
        <Database size={64} className="text-red-500 mb-6" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Koneksi Database Terputus</h2>
        <p className="text-slate-600 max-w-md mb-6">
          Aplikasi belum terhubung ke database. Ganti <b>supabaseUrl</b> dan <b>supabaseAnonKey</b> di dalam kode dengan kunci asli dari akun Supabase Anda. Jangan lupa untuk menghapus tanda komentar pada baris import saat memindahkannya ke komputer Anda.
        </p>
      </div>
    );
  }

  // 0. PUBLIC BOOKING FORM VIEW (CUSTOMER VIEW)
  if (publicVendorId) {
    if (publicFormSuccess) {
      return (
        <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
          <div className="bg-white p-10 rounded-2xl shadow-xl w-full max-w-md text-center">
            <CheckCircle2 size={64} className="text-emerald-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Booking Berhasil Dikirim!</h2>
            <p className="text-slate-600 mb-8">Terima kasih. Tim kami akan segera meninjau jadwal Anda dan mengirimkan rincian invoice.</p>
            <button 
              onClick={() => { setPublicVendorId(null); setPublicFormSuccess(false); }}
              className="bg-slate-900 text-white px-6 py-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              Kembali ke Portal
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50 py-10 px-4 flex justify-center">
        <div className="bg-white p-6 md:p-10 rounded-2xl shadow-lg w-full max-w-2xl border border-slate-200 h-fit">
          <div className="text-center mb-8 border-b pb-6 border-slate-100">
            <h1 className="text-2xl font-bold text-slate-900">Form Booking Acara</h1>
            <p className="text-slate-500 text-sm mt-2">Silakan lengkapi data acara Anda di bawah ini</p>
          </div>
          
          <form onSubmit={handleSubmitPublicBooking} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Calon Mempelai Wanita</label><input type="text" name="bride" required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" placeholder="Cth: Sarah" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Nama Calon Mempelai Pria</label><input type="text" name="groom" required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" placeholder="Cth: Budi" /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">No. WhatsApp</label><input type="text" name="phone" required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" placeholder="0812..." /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Domisili / Alamat</label><input type="text" name="address" required className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" /></div>
            </div>
            <div className="p-4 bg-indigo-50 rounded-xl space-y-4 border border-indigo-100">
              <h3 className="font-semibold text-indigo-900 flex items-center gap-2"><Calendar size={18}/> Detail Pelaksanaan</h3>
              <div className="grid md:grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium text-indigo-800 mb-1">Tanggal Acara</label><input type="date" name="date" required className="w-full p-2.5 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" /></div>
                <div><label className="block text-sm font-medium text-indigo-800 mb-1">Estimasi Waktu</label><input type="text" name="time" required className="w-full p-2.5 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Cth: 08:00 - Selesai" /></div>
              </div>
              <div><label className="block text-sm font-medium text-indigo-800 mb-1">Lokasi Venue / Gedung</label><input type="text" name="venue" required className="w-full p-2.5 border border-indigo-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Nama Gedung, Kota" /></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Minat Paket (Opsional)</label><input type="text" name="packageInterest" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50" placeholder="Cth: Prewedding + Wedding" /></div>
              <div><label className="block text-sm font-medium text-slate-700 mb-1">Catatan Tambahan (Opsional)</label><textarea name="notes" className="w-full p-2.5 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 h-12 resize-none" placeholder="Pesan untuk vendor..."></textarea></div>
            </div>
            <div className="pt-4 flex gap-4">
              <button type="submit" className="flex-1 bg-slate-900 text-white font-medium py-3 rounded-xl hover:bg-slate-800 transition-colors shadow-md">Kirim Data Booking</button>
              <button type="button" onClick={() => setPublicVendorId(null)} className="px-6 bg-slate-200 text-slate-700 font-medium py-3 rounded-xl hover:bg-slate-300 transition-colors">Batal</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 1. LOGIN VIEW
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Vendor Portal</h1>
            <p className="text-slate-500 text-sm mt-2">Silakan login ke akun Anda</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><User size={18} className="text-slate-400" /></div>
                <input type="text" name="username" required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" placeholder="Masukkan username" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><Lock size={18} className="text-slate-400" /></div>
                <input type="password" name="password" required className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-lg outline-none focus:ring-2 focus:ring-slate-500" placeholder="••••••••" />
              </div>
            </div>
            <button type="submit" className="w-full bg-slate-900 text-white font-medium py-2.5 rounded-lg hover:bg-slate-800 transition-colors mt-4">Masuk</button>
          </form>
        </div>
      </div>
    );
  }

  // 2. MANAGE USERS VIEW (OWNER ONLY)
  const ManageUsersView = () => (
    <div className="p-6 md:p-10 max-w-4xl mx-auto w-full">
      <div className="mb-8"><h2 className="text-2xl font-bold text-slate-900">Manajemen Akun</h2><p className="text-slate-500">Tambah dan kelola akses client ke dalam sistem.</p></div>
      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2"><UserPlus size={18} /> Tambah Client</h3>
            <form onSubmit={handleAddUser} className="space-y-4">
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Username</label><input type="text" name="newUsername" required className="w-full p-2 text-sm border rounded-md outline-none focus:border-slate-500 bg-slate-50" /></div>
              <div><label className="block text-xs font-medium text-slate-700 mb-1">Password</label><input type="password" name="newPassword" required className="w-full p-2 text-sm border rounded-md outline-none focus:border-slate-500 bg-slate-50" /></div>
              <button type="submit" className="w-full bg-slate-900 text-white text-sm py-2 rounded-md hover:bg-slate-800 transition-colors">Buat Akun</button>
            </form>
          </div>
        </div>
        <div className="md:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600"><th className="p-4 font-medium">Username</th><th className="p-4 font-medium">Role</th><th className="p-4 font-medium text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {appUsers.map(user => (
                  <tr key={user.id} className="text-sm">
                    <td className="p-4 font-medium text-slate-800">{user.username}</td>
                    <td className="p-4"><span className={`px-2 py-1 text-xs rounded-full ${user.role === 'owner' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'}`}>{user.role}</span></td>
                    <td className="p-4 text-right">
                      {user.role !== 'owner' && (
                        confirmDeleteId === user.id ? (
                          <div className="flex gap-2 justify-end items-center"><span className="text-xs text-red-500 font-medium">Hapus?</span><button onClick={() => handleDeleteUser(user.id)} className="bg-red-500 text-white text-xs px-2 py-1 rounded">Ya</button><button onClick={() => setConfirmDeleteId(null)} className="bg-slate-200 text-slate-700 text-xs px-2 py-1 rounded">Batal</button></div>
                        ) : (<button onClick={() => setConfirmDeleteId(user.id)} className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50"><Trash2 size={16} /></button>)
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  // 3. SETTINGS VIEW (CLIENT ONLY)
  const SettingsView = () => (
    <div className="p-6 md:p-10 max-w-xl mx-auto w-full">
      <div className="mb-8"><h2 className="text-2xl font-bold text-slate-900">Pengaturan Akun</h2><p className="text-slate-500">Perbarui profil dan keamanan akun Anda.</p></div>
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleUpdateProfile} className="space-y-5">
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Username Baru</label><input type="text" name="updateUsername" defaultValue={currentUser.username} required className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50" /></div>
          <div><label className="block text-sm font-medium text-slate-700 mb-1">Password Baru</label><input type="password" name="updatePassword" placeholder="Kosongkan jika tidak ingin mengubah" className="w-full p-2 border rounded-md outline-none focus:ring-2 focus:ring-slate-500 bg-slate-50" /></div>
          <div className="pt-4 border-t border-slate-100"><button type="submit" className="bg-slate-900 text-white px-6 py-2 rounded-md hover:bg-slate-800 transition-colors">Simpan Perubahan</button></div>
        </form>
      </div>
    </div>
  );

  // 4. HISTORY VIEW (FILTERED BY USER ID)
  const HistoryView = () => {
    const userInvoices = invoices.filter(inv => inv.userId.toString() === currentUser.id.toString());
    return (
      <div className="p-6 md:p-10 max-w-5xl mx-auto w-full">
        <div className="mb-8 flex justify-between items-center">
          <div><h2 className="text-2xl font-bold text-slate-900">History Invoice</h2><p className="text-slate-500">Daftar kontrak yang pernah Anda buat dan simpan.</p></div>
          <button onClick={handleNewInvoice} className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"><Plus size={16} /> Buat Baru</button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          {userInvoices.length === 0 ? (
            <div className="p-10 text-center text-slate-500"><History size={48} className="mx-auto mb-4 opacity-20" /><p>Belum ada history invoice.</p></div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead><tr className="bg-slate-50 border-b border-slate-200 text-sm text-slate-600"><th className="p-4 font-medium">Tanggal Dibuat</th><th className="p-4 font-medium">Nama Klien</th><th className="p-4 font-medium">Tanggal Acara</th><th className="p-4 font-medium text-right">Aksi</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {userInvoices.map(inv => (
                  <tr key={inv.id} className="text-sm hover:bg-slate-50">
                    <td className="p-4 text-slate-800">{new Date(inv.createdAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute:'2-digit' })}</td>
                    <td className="p-4 font-medium text-slate-900">{inv.client.groom} & {inv.client.bride}</td>
                    <td className="p-4 text-slate-600">{inv.event.date ? new Date(inv.event.date).toLocaleDateString('id-ID') : '-'}</td>
                    <td className="p-4 text-right"><button onClick={() => handleEditInvoice(inv)} className="text-indigo-600 hover:text-indigo-800 font-medium px-3 py-1 bg-indigo-50 hover:bg-indigo-100 rounded-md">Buka / Edit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  };

  // 5. BOOKINGS VIEW (LEADS DARI CUSTOMER)
  const BookingsView = () => {
    const userBookings = bookings.filter(b => b.vendorId.toString() === currentUser.id.toString());
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto w-full">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-900">Data Booking Masuk</h2>
          <p className="text-slate-500">Daftar calon klien yang mengisi form dari Link Publik Anda.</p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userBookings.length === 0 ? (
            <div className="col-span-full p-10 text-center border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-slate-500 flex flex-col items-center">
              <BookOpen size={48} className="mb-4 opacity-30" />
              <p className="font-medium text-slate-700 mb-1">Belum ada booking masuk</p>
              <p className="text-sm mb-4">Bagikan Link Booking Anda kepada calon klien untuk mulai menerima pesanan.</p>
              <button onClick={copyBookingLink} className="flex items-center gap-2 bg-white border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 text-slate-800 shadow-sm">
                <Copy size={16} /> Salin Link Booking Saya
              </button>
            </div>
          ) : (
            userBookings.map(booking => (
              <div key={booking.id} className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 relative overflow-hidden">
                {booking.status === 'invoiced' && (
                  <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                    Invoice Created
                  </div>
                )}
                
                <div className="flex items-start gap-4 mb-4 mt-2">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg shrink-0">
                    {booking.bride.charAt(0)}{booking.groom.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{booking.bride} & {booking.groom}</h3>
                    <p className="text-xs text-slate-500 mt-1">{booking.phone}</p>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm text-slate-600 mb-6 bg-slate-50 p-3 rounded-lg border border-slate-100">
                  <p className="flex items-center gap-2"><Calendar size={14} className="text-slate-400"/> <span className="font-medium text-slate-800">{new Date(booking.date).toLocaleDateString('id-ID')}</span></p>
                  <p className="flex items-start gap-2"><Building size={14} className="text-slate-400 mt-1 shrink-0"/> <span className="line-clamp-2">{booking.venue}</span></p>
                  {booking.packageInterest && (
                    <p className="flex items-start gap-2"><FileText size={14} className="text-slate-400 mt-1 shrink-0"/> <span className="text-indigo-700 font-medium">{booking.packageInterest}</span></p>
                  )}
                  {booking.notes && (
                    <p className="flex items-start gap-2 border-t border-slate-200 pt-2 mt-2"><MessageSquare size={14} className="text-slate-400 mt-1 shrink-0"/> <span className="italic text-xs">"{booking.notes}"</span></p>
                  )}
                </div>

                {booking.status === 'pending' ? (
                  <button onClick={() => handleCreateInvoiceFromBooking(booking)} className="w-full bg-slate-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-slate-800 transition-colors shadow-sm">
                    Buat Invoice Sekarang
                  </button>
                ) : (
                  <button disabled className="w-full bg-slate-100 text-slate-400 py-2.5 rounded-lg text-sm font-medium cursor-not-allowed">
                    Sudah Dibuatkan Invoice
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    );
  };

  // ================= MAIN APP LAYOUT =================
  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-800 flex flex-col">
      
      {/* NAVBAR (Hidden on Print) */}
      <nav className="bg-white border-b border-gray-200 sticky top-0 z-50 print:hidden shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-6">
              <div className="flex-shrink-0 flex items-center pr-6 border-r border-slate-200 h-8">
                <div className="font-bold text-xl tracking-tight text-slate-900">VENDOR<span className="text-slate-400">PORTAL</span></div>
              </div>
              
              <div className="hidden md:flex space-x-1">
                <button onClick={handleNewInvoice} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'generator' && !editingInvoice ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <FileText size={16} /> Form Invoice
                </button>
                <button onClick={() => setActiveTab('bookings')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 relative ${activeTab === 'bookings' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <BookOpen size={16} /> Data Booking
                  {bookings.filter(b => b.vendorId.toString() === currentUser.id.toString() && b.status === 'pending').length > 0 && (
                    <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </button>
                <button onClick={() => setActiveTab('history')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${(activeTab === 'history' || editingInvoice) ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                  <History size={16} /> History
                </button>
                {currentUser.role === 'owner' && (
                  <button onClick={() => setActiveTab('users')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'users' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Users size={16} /> Manage Users
                  </button>
                )}
                {currentUser.role === 'client' && (
                  <button onClick={() => setActiveTab('settings')} className={`px-3 py-2 rounded-md text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === 'settings' ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'}`}>
                    <Settings size={16} /> Settings
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="hidden lg:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                <LinkIcon size={14} className="text-slate-400" />
                <span className="text-xs text-slate-500 select-none">vendorportal.app/book/{currentUser.id}</span>
                <button onClick={copyBookingLink} title="Salin Link Publik" className="p-1 hover:bg-slate-200 rounded text-slate-600 transition-colors"><Copy size={14}/></button>
                <div className="w-px h-4 bg-slate-300 mx-1"></div>
                <button onClick={() => setPublicVendorId(currentUser.id)} title="Simulasi Tampilan Customer" className="p-1 hover:bg-slate-200 rounded text-indigo-600 transition-colors flex items-center gap-1"><ExternalLink size={14}/></button>
              </div>
              <div className="w-px h-6 bg-slate-200 hidden md:block"></div>
              <div className="text-sm text-right hidden sm:block">
                <p className="font-medium text-slate-900">{currentUser.username}</p>
                <p className="text-xs text-slate-500 capitalize">{currentUser.role}</p>
              </div>
              <button onClick={handleLogout} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Logout"><LogOut size={20} /></button>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="flex-1 flex flex-col">
        {activeTab === 'users' && currentUser.role === 'owner' && <ManageUsersView />}
        {activeTab === 'settings' && currentUser.role === 'client' && <SettingsView />}
        {activeTab === 'history' && <HistoryView />}
        {activeTab === 'bookings' && <BookingsView />}
        
        {/* CONTRACT GENERATOR COMPONENT */}
        {activeTab === 'generator' && (
          <ContractGenerator currentUser={currentUser} initialData={editingInvoice} onSave={handleSaveInvoice} />
        )}
      </main>

      {/* TOAST NOTIFICATION */}
      {toast.show && (
        <div className={`fixed bottom-6 right-6 px-6 py-3 rounded-lg shadow-xl text-white text-sm font-medium z-50 flex items-center gap-3 print:hidden transition-all duration-300 ${toast.type === 'error' ? 'bg-red-600' : 'bg-slate-900'}`}>
          {toast.type === 'error' ? <span className="w-2 h-2 rounded-full bg-red-300 animate-pulse"></span> : <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>}
          {toast.message}
        </div>
      )}
    </div>
  );
}

// ================= CONTRACT GENERATOR (EXTRACTED COMPONENT) =================
function ContractGenerator({ currentUser, initialData, onSave }) {
  const [invoiceId, setInvoiceId] = useState(null);
  const [sourceBookingId, setSourceBookingId] = useState(null);
  const [createdAt, setCreatedAt] = useState(null);

  const [vendor, setVendor] = useState({ name: '', phone: '', email: '', instagram: '', bank: '' });
  const [client, setClient] = useState({ bride: '', groom: '', phone: '', address: '' });
  const [event, setEvent] = useState({ date: '', time: '', venue: '' });
  const [items, setItems] = useState([{ id: 1, name: '', desc: '', price: 0 }]);
  const [dpAmount, setDpAmount] = useState(0);
  const [terms, setTerms] = useState("");

  useEffect(() => {
    if (initialData) {
      setInvoiceId(initialData.id);
      setSourceBookingId(initialData.sourceBookingId || null);
      setCreatedAt(initialData.createdAt);
      setVendor(initialData.vendor || { name: '', phone: '', email: '', instagram: '', bank: '' });
      setClient(initialData.client);
      setEvent(initialData.event);
      setItems(initialData.items && initialData.items.length > 0 ? initialData.items : [{ id: 1, name: '', desc: '', price: 0 }]);
      setDpAmount(initialData.dpAmount || 0);
      setTerms(initialData.terms);
    } else {
      setInvoiceId(null);
      setSourceBookingId(null);
      setCreatedAt(new Date().toISOString());
      setVendor({ name: '', phone: '', email: '', instagram: '', bank: '' });
      setClient({ bride: '', groom: '', phone: '', address: '' });
      setEvent({ date: '', time: '', venue: '' });
      setItems([{ id: Date.now(), name: '', desc: '', price: 0 }]);
      setDpAmount(0);
      setTerms("1. Pembayaran Uang Muka (DP) tidak dapat dikembalikan apabila terjadi pembatalan sepihak oleh klien.\n2. Pelunasan sisa pembayaran wajib diselesaikan selambat-lambatnya H-7 sebelum hari pelaksanaan acara.\n3. Vendor tidak bertanggung jawab atas kegagalan teknis di luar kendali (force majeure) seperti bencana alam.\n4. Waktu penyelesaian editing foto & video adalah maksimal 60 hari kerja setelah hari H acara.\n5. Klien berhak mendapatkan maksimal 2 (dua) kali revisi untuk video cinematic.");
    }
  }, [initialData]);

  const handleSaveInvoice = () => {
    const invoiceData = {
      id: invoiceId || Date.now().toString(),
      userId: currentUser.id.toString(),
      sourceBookingId: sourceBookingId,
      createdAt: createdAt,
      vendor, client, event, items, dpAmount, terms
    };
    onSave(invoiceData);
  };

  const handlePrint = () => { window.focus(); setTimeout(() => { window.print(); }, 150); };
  const formatIDR = (num) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num || 0);
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  };

  const subTotal = items.reduce((acc, item) => acc + Number(item.price), 0);
  const remaining = subTotal - Number(dpAmount);

  const handleAddItem = () => setItems([...items, { id: Date.now(), name: '', desc: '', price: 0 }]);
  const handleRemoveItem = (id) => setItems(items.filter(item => item.id !== id));
  const handleItemChange = (id, field, value) => setItems(items.map(item => item.id === id ? { ...item, [field]: value } : item));

  return (
    <div className="flex flex-col lg:flex-row flex-1 overflow-hidden print:block print:overflow-visible h-[calc(100vh-64px)] print:h-auto bg-gray-200">
      {/* SIDEBAR FORM */}
      <aside className="w-full lg:w-[400px] xl:w-[450px] bg-white border-r border-gray-200 overflow-y-auto print:hidden flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
          <h2 className="text-sm font-semibold text-gray-900">Isi Data Kontrak</h2>
          <div className="flex gap-2">
            <button onClick={handleSaveInvoice} className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"><Save size={14} /> Simpan</button>
            <button onClick={handlePrint} className="bg-slate-900 hover:bg-slate-800 text-white px-3 py-1.5 rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"><Printer size={14} /> Cetak</button>
          </div>
        </div>

        <div className="p-5 space-y-8">
          <section><h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2"><Building size={14} className="text-gray-400" /> Profil Vendor</h2>
            <div className="space-y-3">
              <div><label className="block text-[11px] text-gray-500 mb-1">Nama Vendor</label><input type="text" value={vendor.name} onChange={e => setVendor({...vendor, name: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] text-gray-500 mb-1">Telepon</label><input type="text" value={vendor.phone} onChange={e => setVendor({...vendor, phone: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Instagram</label><input type="text" value={vendor.instagram} onChange={e => setVendor({...vendor, instagram: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
              </div>
              <div><label className="block text-[11px] text-gray-500 mb-1">Rekening Bank</label><input type="text" value={vendor.bank} onChange={e => setVendor({...vendor, bank: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
            </div>
          </section>

          <section><h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2"><User size={14} className="text-gray-400" /> Data Klien</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] text-gray-500 mb-1">CPP (Groom)</label><input type="text" value={client.groom} onChange={e => setClient({...client, groom: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">CPW (Bride)</label><input type="text" value={client.bride} onChange={e => setClient({...client, bride: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 md:col-span-1"><label className="block text-[11px] text-gray-500 mb-1">Telepon Klien</label><input type="text" value={client.phone} onChange={e => setClient({...client, phone: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
                <div className="col-span-2 md:col-span-1"><label className="block text-[11px] text-gray-500 mb-1">Alamat Acara / Klien</label><input type="text" value={client.address} onChange={e => setClient({...client, address: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
              </div>
            </div>
          </section>

          <section><h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2"><Calendar size={14} className="text-gray-400" /> Detail Acara</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-[11px] text-gray-500 mb-1">Tanggal</label><input type="date" value={event.date} onChange={e => setEvent({...event, date: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
                <div><label className="block text-[11px] text-gray-500 mb-1">Waktu</label><input type="text" value={event.time} onChange={e => setEvent({...event, time: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
              </div>
              <div><label className="block text-[11px] text-gray-500 mb-1">Venue / Gedung</label><input type="text" value={event.venue} onChange={e => setEvent({...event, venue: e.target.value})} className="w-full text-sm p-2 border rounded-md bg-gray-50 outline-none focus:ring-1 focus:ring-slate-300" /></div>
            </div>
          </section>

          <section><h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2"><FileText size={14} className="text-gray-400" /> Rincian Tagihan</h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="p-3 border rounded-lg bg-gray-50 relative group">
                  <div className="space-y-2">
                    <input type="text" placeholder="Nama Paket" value={item.name} onChange={e => handleItemChange(item.id, 'name', e.target.value)} className="w-full text-sm p-1.5 border rounded outline-none" />
                    <textarea placeholder="Detail rincian..." value={item.desc} onChange={e => handleItemChange(item.id, 'desc', e.target.value)} className="w-full text-xs p-1.5 border rounded outline-none h-16 resize-none" />
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600">Rp</span>
                      <input type="number" value={item.price} onChange={e => handleItemChange(item.id, 'price', e.target.value)} className="w-full text-sm p-1.5 border rounded outline-none font-medium text-slate-800" />
                    </div>
                  </div>
                  {items.length > 1 && (<button onClick={() => handleRemoveItem(item.id)} className="absolute -top-2 -right-2 bg-red-100 text-red-600 p-1 rounded-full hover:bg-red-200"><Trash2 size={12} /></button>)}
                </div>
              ))}
              <button onClick={handleAddItem} className="w-full py-1.5 border border-dashed border-gray-300 rounded text-xs text-gray-500 hover:text-gray-800 hover:border-gray-400 flex justify-center items-center gap-1 transition-colors"><Plus size={14} /> Tambah Item</button>
            </div>
            <div className="mt-4 pt-3 border-t border-gray-200">
               <label className="block text-[11px] text-gray-500 mb-1">Sudah Dibayar (DP)</label>
               <div className="flex items-center gap-2">
                 <span className="text-xs font-medium text-gray-600">Rp</span>
                 <input type="number" value={dpAmount} onChange={e => setDpAmount(e.target.value)} className="w-full text-sm p-2 border rounded-md bg-emerald-50 outline-none text-emerald-700 font-medium border-emerald-200" />
               </div>
            </div>
          </section>

          <section className="pb-10"><h2 className="text-xs font-semibold text-gray-900 uppercase tracking-wider mb-3 flex items-center gap-2"><CheckCircle2 size={14} className="text-gray-400" /> Syarat & Ketentuan</h2>
            <textarea value={terms} onChange={e => setTerms(e.target.value)} className="w-full text-xs p-2 border rounded-md bg-gray-50 outline-none h-32 resize-y text-slate-600" />
          </section>
        </div>
      </aside>

      {/* DOCUMENT PREVIEW (PRINT AREA) */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:bg-white print:overflow-visible flex justify-center">
        <div className="w-full max-w-[210mm] bg-white shadow-xl min-h-[297mm] p-10 md:p-14 print:shadow-none print:w-full print:max-w-none print:m-0 print:min-h-0 print:p-8 text-slate-800 flex flex-col">
          <header className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-8">
            <div className="w-1/2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 uppercase">{vendor.name || "NAMA VENDOR"}</h1>
              <div className="mt-2 text-sm text-slate-600 space-y-1"><p>{vendor.phone} {vendor.instagram ? `• ${vendor.instagram}` : ''}</p><p>{vendor.email}</p></div>
            </div>
            <div className="w-1/2 text-right">
              <h2 className="text-3xl md:text-4xl font-light text-slate-300 uppercase tracking-widest">Kontrak</h2>
              <p className="text-sm font-bold text-slate-800 mt-2 tracking-widest uppercase">Invoice & Perjanjian</p>
              <p className="text-xs text-slate-500 mt-1">Diterbitkan: {new Date(createdAt).toLocaleDateString('id-ID')}</p>
            </div>
          </header>

          <div className="grid grid-cols-2 gap-8 mb-10 text-sm">
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2 border-b pb-1">Tagihan Kepada</h3>
              <p className="font-bold text-base mt-2 text-slate-900">{client.groom || '........'} & {client.bride || '........'}</p>
              <p className="text-slate-600 mt-1">{client.phone || '-'}</p>
              <p className="text-slate-600 w-3/4 leading-relaxed">{client.address || '-'}</p>
            </div>
            <div>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-2 border-b pb-1">Detail Acara</h3>
              <table className="mt-2 w-full text-slate-600">
                <tbody>
                  <tr><td className="py-1 w-24 font-medium text-slate-800">Tanggal</td><td className="py-1">: {formatDate(event.date)}</td></tr>
                  <tr><td className="py-1 font-medium text-slate-800">Waktu</td><td className="py-1">: {event.time || '-'}</td></tr>
                  <tr><td className="py-1 align-top font-medium text-slate-800">Lokasi</td><td className="py-1">: {event.venue || '-'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="mb-10">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">Rincian Paket & Layanan</h3>
            <div className="border rounded-lg overflow-hidden border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr><th className="py-3 px-4 text-left font-semibold text-slate-700 w-12">No</th><th className="py-3 px-4 text-left font-semibold text-slate-700">Deskripsi Layanan</th><th className="py-3 px-4 text-right font-semibold text-slate-700 w-48">Jumlah (Rp)</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <tr key={item.id}>
                      <td className="py-4 px-4 text-center text-slate-500 align-top">{index + 1}</td>
                      <td className="py-4 px-4 align-top"><p className="font-bold text-slate-900">{item.name || '-'}</p><p className="text-slate-500 mt-1 whitespace-pre-line leading-relaxed text-xs">{item.desc}</p></td>
                      <td className="py-4 px-4 text-right font-medium text-slate-800 align-top">{formatIDR(item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end mt-6">
              <div className="w-full md:w-1/2 space-y-3">
                <div className="flex justify-between text-sm text-slate-600 px-4"><span>Subtotal</span><span>{formatIDR(subTotal)}</span></div>
                <div className="flex justify-between text-sm text-slate-600 px-4"><span>Dibayar (DP)</span><span className="text-emerald-600">- {formatIDR(dpAmount)}</span></div>
                <div className="flex justify-between text-base font-bold text-slate-900 border-t-2 border-slate-900 pt-3 px-4 mt-2 bg-slate-50 rounded-b-lg pb-3"><span>Sisa Pelunasan</span><span>{formatIDR(remaining)}</span></div>
              </div>
            </div>
            <div className="mt-6 text-sm text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100"><span className="font-semibold text-slate-800">Metode Pembayaran: </span><br/>Silakan transfer ke rekening: <span className="font-bold text-slate-900">{vendor.bank || '........................'}</span></div>
          </div>

          <div className="mb-12 flex-grow print:break-inside-avoid">
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-400 mb-3">Syarat & Ketentuan Perjanjian</h3>
            <div className="text-xs text-slate-600 whitespace-pre-line leading-relaxed text-justify bg-gray-50 p-5 rounded-lg border border-gray-100">{terms}</div>
          </div>

          <div className="mt-auto pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-center text-sm print:break-inside-avoid">
            <div><p className="text-slate-500 mb-20">Pihak Pertama (Vendor)</p><p className="font-bold border-b border-slate-300 inline-block px-8 pb-1 text-slate-900">{vendor.name || "........................"}</p></div>
            <div><p className="text-slate-500 mb-20">Pihak Kedua (Klien)</p><p className="font-bold border-b border-slate-300 inline-block px-8 pb-1 text-slate-900">{client.groom || "................"} & {client.bride || "................"}</p></div>
          </div>
        </div>
      </div>
    </div>
  );
}