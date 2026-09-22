"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Mail, Server, Star, Trash2, Users, UserPlus, Loader2, CheckCircle2, XCircle, Pencil, Wifi } from "lucide-react";

const AVATARS = [
  { id: "bear-brown", bg: "bg-amber-100", emoji: "🐻" },
  { id: "lion", bg: "bg-orange-100", emoji: "🦁" },
  { id: "dog", bg: "bg-yellow-100", emoji: "🐕" },
  { id: "chicken", bg: "bg-red-100", emoji: "🐔" },
  { id: "meerkat", bg: "bg-lime-100", emoji: "🦡" },
  { id: "bear-black", bg: "bg-zinc-200", emoji: "🐻‍❄️" },
  { id: "giraffe", bg: "bg-amber-50", emoji: "🦒" },
  { id: "dog-brown", bg: "bg-orange-50", emoji: "🐕‍🦺" },
  { id: "cat", bg: "bg-purple-100", emoji: "🐱" },
  { id: "rabbit", bg: "bg-pink-100", emoji: "🐰" },
];

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null);
  const [profiles, setProfiles] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"smtp" | "users">("users");

  // SMTP form
  const [profileName, setProfileName] = useState("");
  const [smtpServer, setSmtpServer] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [password, setPassword] = useState("");
  const [useTls, setUseTls] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);
  const [testingProfileId, setTestingProfileId] = useState<number | null>(null);
  const [profileTestResult, setProfileTestResult] = useState<Record<number, any>>({});
  const [editingProfile, setEditingProfile] = useState<any>(null);
  const [editProfileOpen, setEditProfileOpen] = useState(false);

  // User form
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserPassword, setNewUserPassword] = useState("");
  const [newUserRole, setNewUserRole] = useState("manager");
  const [newUserAvatar, setNewUserAvatar] = useState("bear-brown");
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDeleteConfirm, setUserDeleteConfirm] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState("manager");
  const [editAvatar, setEditAvatar] = useState("bear-brown");

  useEffect(() => {
    loadData();
    const userData = JSON.parse(localStorage.getItem("user") || "{}");
    setUser(userData);
  }, []);

  const loadData = async () => {
    try {
      const [profilesData, usersData] = await Promise.all([
        api.getSMTPProfiles(),
        api.getUsers?.() || Promise.resolve([]),
      ]);
      setProfiles(profilesData);
      setUsers(usersData);
    } catch (err) {
      console.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    await api.createSMTPProfile({
      profile_name: profileName,
      smtp_server: smtpServer,
      smtp_port: parseInt(smtpPort),
      sender_email: senderEmail,
      sender_name: senderName,
      password: password,
      use_tls: true,
      is_default: profiles.length === 0,
    });
    setDialogOpen(false);
    setProfileName("");
    setSmtpServer("");
    setSmtpPort("587");
    setSenderEmail("");
    setSenderName("");
    setPassword("");
    await loadData();
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const result = await api.testSMTP({
        smtp_server: smtpServer,
        smtp_port: parseInt(smtpPort),
        sender_email: senderEmail,
        password: password,
        use_tls: true,
      });
      setTestResult(result);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "Connection failed" });
    } finally {
      setTesting(false);
    }
  };

  const handleTestExisting = async (p: any) => {
    setTestingProfileId(p.id);
    try {
      const result = await api.testSMTP({
        smtp_server: p.smtp_server,
        smtp_port: p.smtp_port,
        sender_email: p.sender_email,
        password: p.password || "",
        use_tls: p.use_tls !== false,
      });
      if (result && result.success) {
        setProfileTestResult((prev) => ({ ...prev, [p.id]: { success: true, message: "Connected!" } }));
      } else {
        setProfileTestResult((prev) => ({ ...prev, [p.id]: { success: false, message: result?.message || "Failed" } }));
      }
    } catch (err: any) {
      setProfileTestResult((prev) => ({ ...prev, [p.id]: { success: false, message: "Connection failed" } }));
    } finally {
      setTestingProfileId(null);
    }
  };

  const handleEditProfile = (p: any) => {
    setEditingProfile(p);
    setProfileName(p.profile_name);
    setSmtpServer(p.smtp_server);
    setSmtpPort(String(p.smtp_port));
    setSenderEmail(p.sender_email);
    setSenderName(p.sender_name || "");
    setPassword("");
    setEditProfileOpen(true);
  };

  const handleSaveEditProfile = async () => {
    await api.updateSMTPProfile(editingProfile.id, {
      profile_name: profileName,
      smtp_server: smtpServer,
      smtp_port: parseInt(smtpPort),
      sender_email: senderEmail,
      sender_name: senderName,
      use_tls: true,
      password: password || undefined,
    });
    setEditProfileOpen(false);
    setEditingProfile(null);
    await loadData();
  };

  const handleDelete = async (id: number) => {
    await api.deleteSMTPProfile(id);
    setDeleteConfirm(null);
    await loadData();
  };

  const handleCreateUser = async () => {
    await api.createUser({
      email: newUserEmail,
      password: newUserPassword,
      full_name: newUserName,
      role: newUserRole,
      avatar: newUserAvatar,
    });
    setUserDialogOpen(false);
    setNewUserName("");
    setNewUserEmail("");
    setNewUserPassword("");
    setNewUserAvatar("bear-brown");
    await loadData();
  };

  const handleDeleteUser = async (id: number) => {
    await api.deleteUser(id);
    setUserDeleteConfirm(null);
    await loadData();
  };

  const handleEditUser = (u: any) => {
    setEditingUser(u);
    setEditName(u.full_name || "");
    setEditEmail(u.email || "");
    setEditRole(u.role || "manager");
    setEditAvatar(u.avatar || "bear-brown");
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    await api.updateUser(editingUser.id, {
      full_name: editName,
      email: editEmail,
      role: editRole,
      avatar: editAvatar,
    });
    setEditDialogOpen(false);
    setEditingUser(null);
    await loadData();
  };

  const isAdmin = user?.role === "admin";

  const getAvatar = (avatarId: string) => {
    return AVATARS.find(a => a.id === avatarId) || AVATARS[0];
  };

  return (
    <main className="max-w-6xl mx-auto px-8 py-8 dark:text-white">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-2xl font-bold text-[#0A0A0A] dark:text-white">Settings</h2>
          <p className="text-sm text-zinc-500 mt-0.5">Manage SMTP profiles and users</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="inline-flex bg-zinc-100 dark:bg-white/5 rounded-lg p-1 mb-8">
        {isAdmin && (
          <button onClick={() => setActiveTab("users")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "users" ? "bg-white dark:bg-white/15 shadow-sm dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
            <Users className="w-4 h-4" />
            Users
          </button>
        )}
        <button onClick={() => setActiveTab("smtp")} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === "smtp" ? "bg-white dark:bg-white/15 shadow-sm dark:text-white" : "text-zinc-500 dark:text-zinc-400"}`}>
          <Mail className="w-4 h-4" />
          SMTP Profiles
        </button>
      </div>

      {/* User Management */}
      {activeTab === "users" && isAdmin && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* User Cards */}
            {users.map((u: any, idx) => {
              const avatar = getAvatar(u.avatar || "blue");
              return (
                <motion.div
                  key={u.id}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="group bg-white border border-zinc-200 rounded-2xl p-6 hover:border-zinc-300 hover:shadow-lg transition-all relative dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-16 h-16 ${avatar.bg} rounded-full flex items-center justify-center text-3xl`}>
                      {avatar.emoji}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditUser(u)}>
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setUserDeleteConfirm(u.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                  <p className="font-semibold text-sm dark:text-white">{u.full_name || "Unnamed"}</p>
                  <Badge className="mt-1.5 capitalize text-xs">{u.role}</Badge>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 truncate">{u.email}</p>
                </motion.div>
              );
            })}

            {/* Add User Card */}
            <motion.button
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: users.length * 0.05 }}
              onClick={() => setUserDialogOpen(true)}
              className="border-2 border-dashed border-zinc-300 dark:border-white/20 rounded-2xl p-6 hover:border-zinc-400 dark:hover:border-white/40 hover:bg-zinc-50 dark:hover:bg-white/5 transition-all cursor-pointer flex flex-col items-center justify-center min-h-[200px]"
            >
              <div className="w-12 h-12 bg-zinc-100 rounded-full flex items-center justify-center mb-3">
                <UserPlus className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-sm font-medium text-zinc-500">Add User</p>
            </motion.button>
          </div>
        </>
      )}

      {/* SMTP Profiles */}
      {activeTab === "smtp" && (
        <>
          <div className="flex justify-end mb-4">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger className="inline-flex items-center gap-2 bg-[#0A0A0A] text-white text-sm font-medium px-4 py-2.5 rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer">
                <Plus className="w-4 h-4" />
                Add Profile
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Add SMTP Profile</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Profile Name</Label>
                    <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} placeholder="e.g. Gmail" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">SMTP Server</Label>
                    <Input value={smtpServer} onChange={(e) => setSmtpServer(e.target.value)} placeholder="smtp.gmail.com" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Port</Label>
                      <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sender Name</Label>
                      <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Sender Email</Label>
                    <Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Password</Label>
                    <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={useTls} onChange={(e) => setUseTls(e.target.checked)} className="w-4 h-4" />
                    <Label className="text-xs">Use TLS</Label>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={handleTestConnection} disabled={testing || !smtpServer || !senderEmail || !password}>
                      {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Wifi className="w-4 h-4 mr-2" />}
                      Test
                    </Button>
                    <Button className="flex-1" onClick={handleSaveProfile}>Save</Button>
                  </div>
                  {testResult && (
                    <div className={`flex items-center gap-2 text-sm px-4 py-3 rounded-lg ${testResult.success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"}`}>
                      {testResult.success ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                      {testResult.message}
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {profiles.length === 0 ? (
            <Card className="border-zinc-100 shadow-none">
              <CardContent className="p-12 text-center">
                <Mail className="w-12 h-12 mx-auto text-zinc-300 mb-4" />
                <p className="text-zinc-500 font-medium">No SMTP profiles yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {profiles.map((p: any) => (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="group flex items-center justify-between bg-white border border-zinc-200 rounded-xl px-5 py-4 hover:border-zinc-300 hover:shadow-sm transition-all dark:bg-white/5 dark:backdrop-blur-xl dark:border-white/10 dark:hover:border-white/20 dark:shadow-none">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-zinc-50 rounded-lg flex items-center justify-center">
                      <Server className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm dark:text-white">{p.profile_name}</p>
                        {p.is_default && <Badge className="bg-zinc-900 text-white text-xs"><Star className="w-3 h-3 mr-1" fill="currentColor" />Default</Badge>}
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">{p.sender_email} · {p.smtp_server}:{p.smtp_port}</p>
                      {profileTestResult[p.id] && (
                        <p className={`text-[11px] mt-1 font-medium ${profileTestResult[p.id].success ? "text-emerald-600" : "text-red-600"}`}>
                          {profileTestResult[p.id].success ? "✅ Connected" : "❌ Failed"}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleTestExisting(p)} title="Test Connection">
                      {testingProfileId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditProfile(p)} title="Edit">
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700" onClick={() => setDeleteConfirm(p.id)} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Edit SMTP Profile Dialog */}
      <Dialog open={editProfileOpen} onOpenChange={setEditProfileOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit SMTP Profile</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Profile Name</Label>
              <Input value={profileName} onChange={(e) => setProfileName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">SMTP Server</Label>
              <Input value={smtpServer} onChange={(e) => setSmtpServer(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Port</Label>
                <Input type="number" value={smtpPort} onChange={(e) => setSmtpPort(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Sender Name</Label>
                <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Sender Email</Label>
              <Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password (leave blank to keep current)</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <Button className="w-full" onClick={handleSaveEditProfile}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Dialog */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
            <DialogDescription>Choose an avatar and enter user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Avatar Grid */}
            <div className="space-y-2">
              <Label className="text-xs">Choose Avatar</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setNewUserAvatar(avatar.id)}
                    className={`w-12 h-12 ${avatar.bg} rounded-full flex items-center justify-center text-2xl transition-all cursor-pointer ${
                      newUserAvatar === avatar.id ? "ring-2 ring-offset-2 ring-[#0A0A0A] scale-110" : "hover:scale-105"
                    }`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={newUserName} onChange={(e) => setNewUserName(e.target.value)} placeholder="John Doe" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={newUserEmail} onChange={(e) => setNewUserEmail(e.target.value)} placeholder="user@company.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Password</Label>
              <Input type="password" value={newUserPassword} onChange={(e) => setNewUserPassword(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <select value={newUserRole} onChange={(e) => setNewUserRole(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm">
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button className="w-full" onClick={handleCreateUser}>Create User</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-xs">Choose Avatar</Label>
              <div className="grid grid-cols-5 gap-2">
                {AVATARS.map((avatar) => (
                  <button
                    key={avatar.id}
                    onClick={() => setEditAvatar(avatar.id)}
                    className={`w-12 h-12 ${avatar.bg} rounded-full flex items-center justify-center text-2xl transition-all cursor-pointer ${
                      editAvatar === avatar.id ? "ring-2 ring-offset-2 ring-[#0A0A0A] scale-110" : "hover:scale-105"
                    }`}
                  >
                    {avatar.emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Role</Label>
              <select value={editRole} onChange={(e) => setEditRole(e.target.value)} className="w-full px-3 py-2 border border-zinc-200 rounded-md text-sm">
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <Button className="w-full" onClick={handleSaveEdit}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Dialogs */}
      <Dialog open={deleteConfirm !== null} onOpenChange={() => setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete Profile?</DialogTitle></DialogHeader>
          <div className="flex gap-2 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDelete(deleteConfirm!)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={userDeleteConfirm !== null} onOpenChange={() => setUserDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader><DialogTitle>Delete User?</DialogTitle></DialogHeader>
          <div className="flex gap-2 py-4">
            <Button variant="outline" className="flex-1" onClick={() => setUserDeleteConfirm(null)}>Cancel</Button>
            <Button variant="destructive" className="flex-1" onClick={() => handleDeleteUser(userDeleteConfirm!)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  );
}
