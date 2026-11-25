import { baseDeDatos } from '../servidor/dist/infraestructura/base-de-datos/cliente-postgresql.js';

async function main() {
  try {
    const res = await baseDeDatos.ejecutarConsulta(
      'SELECT identificador_empresa, codigo_identificador, nombre_razon_social, registro_fiscal FROM empresa_razon_social'
    );
    console.log(JSON.stringify(res.rows, null, 2));
    await baseDeDatos.desconectar();
  } catch (e) {
    console.error(e);
  }
}

main();
