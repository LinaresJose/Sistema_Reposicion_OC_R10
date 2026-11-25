// Vista de Administracion: Gestion de Usuarios y Razones Sociales
// Solo visible para ADMINISTRADOR_SISTEMA
import React, { useState, useEffect, useCallback } from 'react';
import { Users, Building2, Plus, Edit2, ToggleLeft, ToggleRight, Upload, Eye, EyeOff, RefreshCw, Shield } from 'lucide-react';
import { usarAutenticacion } from '../contextos/contexto-autenticacion.js';
import { servicioAdmin, UsuarioAdmin, RazonSocialAdmin, FormularioCrearUsuario, FormularioActualizarUsuario } from '../servicios/servicio-admin.js';
import { Modal } from '../componentes/comunes/Modal.js';

type SeccionAdmin = 'USUARIOS' | 'RAZONES_SOCIALES';

const ETIQUETAS_ROL: Record<string, string> = {
  ADMINISTRADOR_SISTEMA: 'Administrador',
  GERENTE_COMPRAS: 'Gerente de Compras',
  ANALISTA_COMPRAS: 'Analista de Compras',
  AUDITOR_CONTROL: 'Auditor de Control'
};

const ETIQUETAS_CATEGORIA: Record<string, string> = {
  NACIONAL_1: 'Nacional 1',
  NACIONAL_2: 'Nacional 2',
  NACIONAL_3: 'Nacional 3',
  INTERNACIONAL: 'Internacional',
  NINGUNA: 'Sin categoria'
};

const COLORES_ROL: Record<string, string> = {
  ADMINISTRADOR_SISTEMA: 'bg-purple-100 text-purple-800',
  GERENTE_COMPRAS: 'bg-sky-100 text-sky-800',
  ANALISTA_COMPRAS: 'bg-emerald-100 text-emerald-800',
  AUDITOR_CONTROL: 'bg-amber-100 text-amber-800'
};

// ----- Modal Crear/Editar Usuario -----
interface ModalUsuarioProps {
  abierto: boolean;
  usuarioEditar?: UsuarioAdmin | null;
  alCerrar: () => void;
  alGuardar: () => void;
}

const ModalUsuario: React.FC<ModalUsuarioProps> = ({ abierto, usuarioEditar, alCerrar, alGuardar }) => {
  const esEdicion = !!usuarioEditar;
  const [form, setForm] = useState<FormularioCrearUsuario>({
    nombreCompleto: '',
    correoElectronico: '',
    contrasenaPlana: '',
    rolId: 'ANALISTA_COMPRAS',
    categoriaCompradora: 'NINGUNA',
    telefonoContacto: ''
  });
  const [nuevaContrasena, setNuevaContrasena] = useState('');
  const [verContrasena, setVerContrasena] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      if (usuarioEditar) {
        setForm({
          nombreCompleto: usuarioEditar.nombreCompleto,
          correoElectronico: usuarioEditar.correoElectronico,
          contrasenaPlana: '',
          rolId: usuarioEditar.rolId,
          categoriaCompradora: usuarioEditar.categoriaCompradora,
          telefonoContacto: usuarioEditar.telefonoContacto || ''
        });
      } else {
        setForm({ nombreCompleto: '', correoElectronico: '', contrasenaPlana: '', rolId: 'ANALISTA_COMPRAS', categoriaCompradora: 'NINGUNA', telefonoContacto: '' });
      }
      setNuevaContrasena('');
      setError(null);
    }
  }, [abierto, usuarioEditar]);

  const manejarGuardar = async () => {
    setError(null);
    setCargando(true);
    try {
      if (esEdicion && usuarioEditar) {
        const datos: FormularioActualizarUsuario = {
          nombreCompleto: form.nombreCompleto,
          rolId: form.rolId,
          categoriaCompradora: form.categoriaCompradora,
          telefonoContacto: form.telefonoContacto || null
        };
        if (nuevaContrasena) datos.nuevaContrasena = nuevaContrasena;
        await servicioAdmin.actualizarUsuario(usuarioEditar.identificadorUsuario, datos);
      } else {
        await servicioAdmin.crearUsuario({ ...form, contrasenaPlana: form.contrasenaPlana });
      }
      alGuardar();
    } catch (e: any) {
      setError(e?.message || 'Error al guardar usuario.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <Modal estaAbierto={abierto} alCerrar={alCerrar} titulo={esEdicion ? 'Editar Usuario' : 'Nuevo Usuario'} tamano="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nombre Completo *</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.nombreCompleto}
              onChange={e => setForm(f => ({ ...f, nombreCompleto: e.target.value }))}
              placeholder="Nombre y Apellido"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Telefono de Contacto</label>
            <input
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.telefonoContacto}
              onChange={e => setForm(f => ({ ...f, telefonoContacto: e.target.value }))}
              placeholder="+58-412-0000000"
            />
          </div>
        </div>

        {!esEdicion && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correo Electronico *</label>
            <input
              type="email"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.correoElectronico}
              onChange={e => setForm(f => ({ ...f, correoElectronico: e.target.value }))}
              placeholder="usuario@empresa.com"
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Rol del Sistema *</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.rolId}
              onChange={e => setForm(f => ({ ...f, rolId: e.target.value }))}
            >
              <option value="ADMINISTRADOR_SISTEMA">Administrador del Sistema</option>
              <option value="GERENTE_COMPRAS">Gerente de Compras</option>
              <option value="ANALISTA_COMPRAS">Analista de Compras</option>
              <option value="AUDITOR_CONTROL">Auditor de Control</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Categoria Compradora</label>
            <select
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={form.categoriaCompradora}
              onChange={e => setForm(f => ({ ...f, categoriaCompradora: e.target.value }))}
            >
              <option value="NINGUNA">Sin categoria</option>
              <option value="NACIONAL_1">Nacional 1</option>
              <option value="NACIONAL_2">Nacional 2</option>
              <option value="NACIONAL_3">Nacional 3</option>
              <option value="INTERNACIONAL">Internacional</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            {esEdicion ? 'Nueva Contrasena (dejar vacio para no cambiar)' : 'Contrasena Inicial *'}
          </label>
          <div className="relative">
            <input
              type={verContrasena ? 'text' : 'password'}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
              value={esEdicion ? nuevaContrasena : form.contrasenaPlana}
              onChange={e => esEdicion ? setNuevaContrasena(e.target.value) : setForm(f => ({ ...f, contrasenaPlana: e.target.value }))}
              placeholder="Minimo 8 caracteres"
            />
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              onClick={() => setVerContrasena(v => !v)}
            >
              {verContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">Minimo 8 caracteres. Se aplica Argon2id.</p>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={alCerrar} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
            Cancelar
          </button>
          <button
            onClick={manejarGuardar}
            disabled={cargando}
            className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm transition-colors disabled:opacity-50"
          >
            {cargando ? 'Guardando...' : (esEdicion ? 'Guardar Cambios' : 'Crear Usuario')}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ----- Modal Editar Razon Social -----
interface ModalRazonSocialProps {
  abierto: boolean;
  razonSocial: RazonSocialAdmin | null;
  alCerrar: () => void;
  alGuardar: () => void;
}

const ModalRazonSocial: React.FC<ModalRazonSocialProps> = ({ abierto, razonSocial, alCerrar, alGuardar }) => {
  const [form, setForm] = useState({ nombreLegal: '', rif: '', direccionFiscal: '', telefonos: '', correoContacto: '' });
  const [logoBase64, setLogoBase64] = useState<string>('');
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (abierto && razonSocial) {
      setForm({
        nombreLegal: razonSocial.nombreLegal,
        rif: razonSocial.rif,
        direccionFiscal: razonSocial.direccionFiscal,
        telefonos: razonSocial.telefonos || '',
        correoContacto: razonSocial.correoContacto || ''
      });
      setLogoBase64('');
      setError(null);
    }
  }, [abierto, razonSocial]);

  const manejarSeleccionarLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = ev => {
      const resultado = ev.target?.result as string;
      // Guardar solo la parte base64 (despues de la coma)
      setLogoBase64(resultado.split(',')[1] || '');
    };
    lector.readAsDataURL(archivo);
  };

  const manejarGuardar = async () => {
    if (!razonSocial) return;
    setError(null);
    setCargando(true);
    try {
      const datos: Record<string, string> = { ...form };
      if (logoBase64) datos.urlLogoBase64 = logoBase64;
      await servicioAdmin.actualizarRazonSocial(razonSocial.id, datos);
      alGuardar();
    } catch (e: any) {
      setError(e?.message || 'Error al actualizar razon social.');
    } finally {
      setCargando(false);
    }
  };

  if (!razonSocial) return null;

  return (
    <Modal estaAbierto={abierto} alCerrar={alCerrar} titulo={`Editar: ${razonSocial.codigoIdentificador}`} tamano="lg">
      <div className="space-y-4">
        {error && <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3">{error}</div>}

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Razon Social / Nombre Legal</label>
          <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.nombreLegal} onChange={e => setForm(f => ({ ...f, nombreLegal: e.target.value }))} />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">RIF</label>
            <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.rif} onChange={e => setForm(f => ({ ...f, rif: e.target.value }))} placeholder="J-00000000-0" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Correo de Contacto</label>
            <input type="email" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.correoContacto} onChange={e => setForm(f => ({ ...f, correoContacto: e.target.value }))} />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Direccion Fiscal</label>
          <textarea className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm resize-none" rows={2} value={form.direccionFiscal} onChange={e => setForm(f => ({ ...f, direccionFiscal: e.target.value }))} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Telefonos</label>
          <input className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm" value={form.telefonos} onChange={e => setForm(f => ({ ...f, telefonos: e.target.value }))} placeholder="+58-241-0000000" />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Logo de la Empresa (PNG/JPG)</label>
          <div className="flex items-center gap-3">
            <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors">
              <Upload className="w-4 h-4" />
              {logoBase64 ? 'Logo seleccionado' : (razonSocial.tieneLogoConfigurado ? 'Reemplazar logo' : 'Subir logo')}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={manejarSeleccionarLogo} />
            </label>
            {logoBase64 && (
              <img
                src={`data:image/png;base64,${logoBase64}`}
                alt="Vista previa"
                className="h-10 object-contain border border-slate-200 rounded"
              />
            )}
            {!logoBase64 && razonSocial.tieneLogoConfigurado && (
              <span className="text-xs text-emerald-600 font-semibold">✓ Logo configurado</span>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button onClick={alCerrar} className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">Cancelar</button>
          <button onClick={manejarGuardar} disabled={cargando} className="px-4 py-2 text-xs font-semibold text-white bg-sky-700 hover:bg-sky-800 rounded-lg shadow-sm transition-colors disabled:opacity-50">
            {cargando ? 'Guardando...' : 'Guardar Cambios'}
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ----- Vista Principal de Administracion -----
export const VistaAdministracion: React.FC = () => {
  const { esAdmin } = usarAutenticacion();
  const [seccion, setSeccion] = useState<SeccionAdmin>('USUARIOS');
  const [usuarios, setUsuarios] = useState<UsuarioAdmin[]>([]);
  const [razonesSociales, setRazonesSociales] = useState<RazonSocialAdmin[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalUsuario, setModalUsuario] = useState(false);
  const [usuarioEditar, setUsuarioEditar] = useState<UsuarioAdmin | null>(null);
  const [modalRazonSocial, setModalRazonSocial] = useState(false);
  const [razonSocialEditar, setRazonSocialEditar] = useState<RazonSocialAdmin | null>(null);

  const cargarUsuarios = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const resultado = await servicioAdmin.listarUsuarios();
      setUsuarios(resultado.usuarios);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar usuarios.');
    } finally {
      setCargando(false);
    }
  }, []);

  const cargarRazonesSociales = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const lista = await servicioAdmin.listarRazonesSociales();
      setRazonesSociales(lista);
    } catch (e: any) {
      setError(e?.message || 'Error al cargar razones sociales.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (seccion === 'USUARIOS') cargarUsuarios();
    else cargarRazonesSociales();
  }, [seccion, cargarUsuarios, cargarRazonesSociales]);

  const manejarToggleActivo = async (usuario: UsuarioAdmin) => {
    try {
      await servicioAdmin.actualizarUsuario(usuario.identificadorUsuario, { estaActivo: !usuario.estaActivo });
      await cargarUsuarios();
    } catch (e: any) {
      setError(e?.message || 'Error al cambiar estado del usuario.');
    }
  };

  if (!esAdmin) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-16 text-center">
        <Shield className="w-12 h-12 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-semibold text-slate-700">Acceso restringido al Administrador del Sistema.</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Encabezado */}
      <div className="mb-6">
        <h1 className="text-lg font-bold text-slate-900">Panel de Administracion del Sistema</h1>
        <p className="text-xs text-slate-500 mt-1">Gestion de usuarios, roles y razones sociales emisoras.</p>
      </div>

      {/* Pestanas de seccion */}
      <div className="flex gap-1 mb-6 border-b border-slate-200">
        <button
          onClick={() => setSeccion('USUARIOS')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
            seccion === 'USUARIOS'
              ? 'border-sky-600 text-sky-700 bg-sky-50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Users className="w-4 h-4" /> Usuarios del Sistema
        </button>
        <button
          onClick={() => setSeccion('RAZONES_SOCIALES')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-t-lg border-b-2 transition-colors ${
            seccion === 'RAZONES_SOCIALES'
              ? 'border-sky-600 text-sky-700 bg-sky-50'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Building2 className="w-4 h-4" /> Razones Sociales
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded-lg p-3 mb-4">{error}</div>
      )}

      {/* Seccion Usuarios */}
      {seccion === 'USUARIOS' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500">{usuarios.length} usuario(s) registrado(s)</p>
            <div className="flex gap-2">
              <button onClick={cargarUsuarios} className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors" title="Recargar">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setUsuarioEditar(null); setModalUsuario(true); }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-sky-700 hover:bg-sky-800 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Nuevo Usuario
              </button>
            </div>
          </div>

          {cargando ? (
            <div className="text-center py-8 text-xs text-slate-400">Cargando usuarios...</div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Usuario</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Correo</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Rol</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Categoria</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Telefono</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Estado</th>
                    <th className="text-center px-4 py-3 font-semibold text-slate-600">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {usuarios.map(u => (
                    <tr key={u.identificadorUsuario} className={`hover:bg-slate-50 ${!u.estaActivo ? 'opacity-60' : ''}`}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{u.nombreCompleto}</td>
                      <td className="px-4 py-3 text-slate-600">{u.correoElectronico}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${COLORES_ROL[u.rolId] || 'bg-slate-100 text-slate-700'}`}>
                          {ETIQUETAS_ROL[u.rolId] || u.rolId}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{ETIQUETAS_CATEGORIA[u.categoriaCompradora] || u.categoriaCompradora}</td>
                      <td className="px-4 py-3 text-slate-500">{u.telefonoContacto || '—'}</td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => manejarToggleActivo(u)}
                          className={`${u.estaActivo ? 'text-emerald-600 hover:text-emerald-800' : 'text-slate-400 hover:text-slate-600'} transition-colors`}
                          title={u.estaActivo ? 'Desactivar usuario' : 'Activar usuario'}
                        >
                          {u.estaActivo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() => { setUsuarioEditar(u); setModalUsuario(true); }}
                          className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                          title="Editar usuario"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {usuarios.length === 0 && !cargando && (
                    <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay usuarios registrados.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Seccion Razones Sociales */}
      {seccion === 'RAZONES_SOCIALES' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-slate-500">Empresas emisoras de ordenes de compra</p>
            <button onClick={cargarRazonesSociales} className="p-2 text-slate-500 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors" title="Recargar">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {cargando ? (
            <div className="text-center py-8 text-xs text-slate-400">Cargando razones sociales...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {razonesSociales.map(rs => (
                <div key={rs.id} className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-0.5 rounded">{rs.codigoIdentificador}</span>
                      {rs.tieneLogoConfigurado && (
                        <span className="ml-2 text-[10px] font-semibold text-emerald-600">✓ Con logo</span>
                      )}
                    </div>
                    <button
                      onClick={() => { setRazonSocialEditar(rs); setModalRazonSocial(true); }}
                      className="p-1.5 text-slate-400 hover:text-sky-700 hover:bg-sky-50 rounded-lg transition-colors"
                      title="Editar datos fiscales"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-sm font-bold text-slate-900 mb-1">{rs.nombreLegal}</h3>
                  <p className="text-xs text-slate-500 mb-1"><span className="font-semibold">RIF:</span> {rs.rif}</p>
                  <p className="text-xs text-slate-500 mb-1 leading-relaxed">{rs.direccionFiscal}</p>
                  {rs.telefonos && <p className="text-xs text-slate-500"><span className="font-semibold">Tel:</span> {rs.telefonos}</p>}
                  {rs.correoContacto && <p className="text-xs text-slate-500"><span className="font-semibold">Email:</span> {rs.correoContacto}</p>}
                  <p className="text-[10px] text-slate-400 mt-2">
                    Actualizado: {new Date(rs.fechaActualizacion).toLocaleDateString('es-VE')}
                  </p>
                </div>
              ))}
              {razonesSociales.length === 0 && !cargando && (
                <p className="col-span-2 text-center py-8 text-xs text-slate-400">No hay razones sociales configuradas.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modales */}
      <ModalUsuario
        abierto={modalUsuario}
        usuarioEditar={usuarioEditar}
        alCerrar={() => { setModalUsuario(false); setUsuarioEditar(null); }}
        alGuardar={() => { setModalUsuario(false); setUsuarioEditar(null); cargarUsuarios(); }}
      />
      <ModalRazonSocial
        abierto={modalRazonSocial}
        razonSocial={razonSocialEditar}
        alCerrar={() => { setModalRazonSocial(false); setRazonSocialEditar(null); }}
        alGuardar={() => { setModalRazonSocial(false); setRazonSocialEditar(null); cargarRazonesSociales(); }}
      />
    </div>
  );
};
