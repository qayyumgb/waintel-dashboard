"use client";

import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { useAuth } from "@/lib/useAuth";
import Toast from "@/components/Toast";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

interface Room {
  id: string;
  room_type: string;
  price_per_night: number;
  capacity: number;
  total_rooms: number;
  amenities: string | null;
  is_available: boolean;
}

const emptyRoom = {
  roomType: "",
  pricePerNight: "",
  capacity: "2",
  totalRooms: "1",
  amenities: "",
};

export default function RoomsPage() {
  const { botId, tenantId } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [form, setForm] = useState(emptyRoom);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const fetchRooms = useCallback(async () => {
    if (!botId) return;
    try {
      const res = await axios.get(`${API}/api/hotels/rooms?botId=${botId}`);
      setRooms(res.data.rooms || []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, [botId]);

  useEffect(() => { fetchRooms(); }, [fetchRooms]);

  const openAdd = () => { setEditing(null); setForm(emptyRoom); setShowModal(true); };
  const openEdit = (r: Room) => {
    setEditing(r);
    setForm({
      roomType: r.room_type,
      pricePerNight: String(r.price_per_night),
      capacity: String(r.capacity),
      totalRooms: String(r.total_rooms),
      amenities: r.amenities || "",
    });
    setShowModal(true);
  };

  const saveRoom = async () => {
    if (!form.roomType || !botId) return;
    setSaving(true);
    try {
      if (editing) {
        await axios.patch(`${API}/api/hotels/rooms/${editing.id}`, {
          pricePerNight: parseFloat(form.pricePerNight) || 0,
          amenities: form.amenities || null,
        });
        setToast({ message: "Room updated", type: "success" });
      } else {
        await axios.post(`${API}/api/hotels/rooms`, {
          botId, tenantId,
          roomType: form.roomType,
          pricePerNight: parseFloat(form.pricePerNight) || 0,
          capacity: parseInt(form.capacity) || 2,
          totalRooms: parseInt(form.totalRooms) || 1,
          amenities: form.amenities || null,
        });
        setToast({ message: "Room added", type: "success" });
      }
      setShowModal(false);
      fetchRooms();
    } catch {
      setToast({ message: "Failed to save room", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const toggleAvailability = async (room: Room) => {
    try {
      await axios.patch(`${API}/api/hotels/rooms/${room.id}`, { isAvailable: !room.is_available });
      setRooms((prev) => prev.map((r) => r.id === room.id ? { ...r, is_available: !r.is_available } : r));
    } catch {
      setToast({ message: "Failed to update availability", type: "error" });
    }
  };

  const deleteRoom = async (id: string) => {
    try {
      await axios.delete(`${API}/api/hotels/rooms/${id}`);
      setRooms((prev) => prev.filter((r) => r.id !== id));
      setToast({ message: "Room deleted", type: "success" });
    } catch {
      setToast({ message: "Failed to delete room", type: "error" });
    }
  };

  return (
    <div className="p-8 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="page-breadcrumb">
            <svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
            Rooms
          </div>
          <h1 className="text-[28px] font-bold text-slate-900 mb-1">Room Management</h1>
          <p className="text-[15px] text-slate-500">Manage your hotel rooms, pricing and availability.</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          Add Room
        </button>
      </div>

      {/* Rooms grid */}
      {loading ? (
        <div className="text-center py-20 text-slate-400">Loading rooms...</div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: "rgba(29,158,117,0.08)" }}>
            <svg width="28" height="28" fill="none" viewBox="0 0 24 24" stroke="#1D9E75" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1" />
            </svg>
          </div>
          <p className="text-[15px] font-semibold text-slate-600 mb-1">No rooms yet</p>
          <p className="text-[13px] text-slate-400 mb-5">Add your first room to start taking bookings.</p>
          <button onClick={openAdd} className="btn-primary">+ Add First Room</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {rooms.map((room) => (
            <div key={room.id} className="card flex flex-col gap-3">
              {/* Room type + availability badge */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-[16px] font-bold text-slate-800">{room.room_type}</h3>
                  <p className="text-[12px] text-slate-400 mt-0.5">{room.total_rooms} room{room.total_rooms !== 1 ? "s" : ""} · {room.capacity} guests max</p>
                </div>
                <span
                  className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                  style={room.is_available
                    ? { background: "#e8f5e9", color: "#1b5e20" }
                    : { background: "#fef2f2", color: "#b91c1c" }
                  }
                >
                  {room.is_available ? "● Available" : "● Booked"}
                </span>
              </div>

              {/* Price */}
              <div className="text-[22px] font-bold" style={{ color: "#1D9E75" }}>
                Rs. {Number(room.price_per_night).toLocaleString()}
                <span className="text-[13px] font-normal text-slate-400"> / night</span>
              </div>

              {/* Amenities */}
              {room.amenities && (
                <p className="text-[12px] text-slate-500 leading-relaxed">{room.amenities}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-2 pt-1 mt-auto">
                <button
                  onClick={() => toggleAvailability(room)}
                  className="flex-1 py-2 rounded-lg text-[12px] font-semibold transition-all"
                  style={room.is_available
                    ? { background: "#fef2f2", color: "#b91c1c" }
                    : { background: "#e8f5e9", color: "#1b5e20" }
                  }
                >
                  {room.is_available ? "Mark Booked" : "Mark Available"}
                </button>
                <button
                  onClick={() => openEdit(room)}
                  className="px-4 py-2 rounded-lg text-[12px] font-semibold"
                  style={{ background: "rgba(29,158,117,0.08)", color: "#047857" }}
                >
                  Edit
                </button>
                <button
                  onClick={() => deleteRoom(room.id)}
                  className="px-3 py-2 rounded-lg text-[12px] font-semibold"
                  style={{ background: "#fef2f2", color: "#b91c1c" }}
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.4)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <h2 className="text-[17px] font-bold text-slate-800 mb-5">
              {editing ? "Edit Room" : "Add New Room"}
            </h2>
            <div className="space-y-4">
              <div>
                <label className="form-label">Room Type / Name</label>
                <input
                  className="form-input"
                  value={form.roomType}
                  onChange={(e) => setForm((f) => ({ ...f, roomType: e.target.value }))}
                  placeholder="Deluxe Double, Standard, Family Suite..."
                  disabled={!!editing}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="form-label">Price / Night (Rs.)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.pricePerNight}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerNight: e.target.value }))}
                    placeholder="5000"
                  />
                </div>
                <div>
                  <label className="form-label">Max Guests</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.capacity}
                    onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))}
                  />
                </div>
              </div>
              {!editing && (
                <div>
                  <label className="form-label">Total Rooms of this Type</label>
                  <input
                    type="number"
                    className="form-input"
                    value={form.totalRooms}
                    onChange={(e) => setForm((f) => ({ ...f, totalRooms: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className="form-label">Amenities</label>
                <input
                  className="form-input"
                  value={form.amenities}
                  onChange={(e) => setForm((f) => ({ ...f, amenities: e.target.value }))}
                  placeholder="WiFi, TV, AC, Hot water, Mountain view"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={saveRoom} disabled={saving || !form.roomType} className="btn-primary flex-1">
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Room"}
              </button>
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl text-[13px] font-medium text-slate-500 border border-slate-200"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
    </div>
  );
}
