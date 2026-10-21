import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { q } from './db.js';

async function generarUsuariosDesdeEstudiantes() {
  try {
    console.log('🔄 Leyendo la lista de estudiantes desde la base de datos...');
    const resultado = await q('SELECT ci, nombres, apellidos FROM estudiantes');
    const estudiantes = resultado.rows;
    
    console.log(`📊 Se encontraron ${estudiantes.length} estudiantes. Procesando credenciales...`);

    for (const est of estudiantes) {
      const ci = String(est.ci).trim();
      const nombresTrim = est.nombres.trim();
      const apellidosTrim = est.apellidos.trim();
      const nombreCompleto = `${nombresTrim} ${apellidosTrim}`;

      // Regla: Si tiene 1 nombre se usa ese, si tiene 2 o más se usan los dos primeros
      const palabrasNombres = nombresTrim.split(/\s+/);
      let usernameBase = palabrasNombres.length === 1 
        ? palabrasNombres[0] 
        : `${palabrasNombres[0]} ${palabrasNombres[1]}`;

      // Normalizar el nombre de usuario (minúsculas, sin espacios, con guion bajo)
      const usuario = usernameBase.toLowerCase().replace(/\s+/g, '_');

      // Contraseña hasheada con bcrypt usando el CI
      const passwordHash = await bcrypt.hash(ci, 10);
      const rol = 'responsable';

      await q(`
        INSERT INTO usuarios (nombre, usuario, password_hash, rol)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (usuario) 
        DO UPDATE SET password_hash = $3, rol = $4;
      `, [nombreCompleto, usuario, passwordHash, rol]);

      console.log(`✔ Usuario: [ ${usuario} ] | CI (Password): ${ci}`);
    }

    console.log('\n🎉 ¡Los 91 usuarios han sido migrados e insertados exitosamente!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error al generar usuarios:', error);
    process.exit(1);
  }
}

generarUsuariosDesdeEstudiantes();
