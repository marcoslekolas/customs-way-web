# ⚠️ SOLUCIÓN AL ERROR 404 DE VERCEL

## 🔍 Diagnóstico

El error **404: NOT_FOUND** que estás viendo se debe a que **Vercel no tiene configuradas las variables de entorno** necesarias para que la aplicación funcione.

Tu proyecto está correctamente subido a GitHub y el build funciona localmente, pero Vercel necesita las credenciales de Supabase para funcionar.

---

## ✅ Solución en 3 Pasos

### **Paso 1: Ir a la Configuración del Proyecto en Vercel**

1. Ve a [vercel.com](https://vercel.com)
2. Abre tu proyecto **customs-way-web**
3. Haz clic en **"Settings"** (en el menú superior)
4. En el menú lateral, selecciona **"Environment Variables"**

---

### **Paso 2: Añadir las Variables de Entorno**

Añade estas **3 variables** una por una:

#### Variable 1: NEXT_PUBLIC_SUPABASE_URL
- **Key**: `NEXT_PUBLIC_SUPABASE_URL`
- **Value**: `https://suwhjnujlqspvhkbnjsx.supabase.co`
- **Environments**: Selecciona **Production**, **Preview**, y **Development** (todos)
- Haz clic en **"Save"**

#### Variable 2: NEXT_PUBLIC_SUPABASE_ANON_KEY
- **Key**: `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d2hqbnVqbHFzcHZoa2JuanN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njg2MzQ0ODYsImV4cCI6MjA4NDIxMDQ4Nn0.djzCX79jqNCEqwkDyBUmHSVpNhFcJN42hjnpLvoXL0A`
- **Environments**: Selecciona **Production**, **Preview**, y **Development** (todos)
- Haz clic en **"Save"**

#### Variable 3: SUPABASE_SERVICE_ROLE_KEY
- **Key**: `SUPABASE_SERVICE_ROLE_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1d2hqbnVqbHFzcHZoa2JuanN4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODYzNDQ4NiwiZXhwIjoyMDg0MjEwNDg2fQ.on3-Dcbjgpd3wk6PkE451ar2o8f0EK3bosb072sRu0A`
- **Environments**: Selecciona **Production**, **Preview**, y **Development** (todos)
- Haz clic en **"Save"**

---

### **Paso 3: Re-desplegar la Aplicación**

Después de añadir las variables, tienes **2 opciones**:

#### Opción A: Re-deploy Manual (Recomendado)
1. Ve a la pestaña **"Deployments"**
2. Haz clic en el deployment más reciente (el que dio error 404)
3. Haz clic en el botón de **"..."** (tres puntos) en la esquina superior derecha
4. Selecciona **"Redeploy"**
5. Confirma con **"Redeploy"**

#### Opción B: Forzar Nuevo Deploy desde Git
1. Abre tu terminal
2. Ejecuta:
   ```bash
   cd ~/Desktop/customs-way-web-deploy
   git commit --allow-empty -m "Trigger Vercel redeploy con variables de entorno"
   git push
   ```

---

## 🎯 Verificación

Una vez que el despliegue termine (1-2 minutos):

1. Haz clic en **"Visit"** o en la URL de tu proyecto
2. Deberías ver la **pantalla de login** de Customs-Way
3. ✅ **¡Funcionando!**

---

## 🐛 Si Aún Tienes Problemas

### Ver los Logs del Build
1. Ve a **"Deployments"** en Vercel
2. Haz clic en el último deployment
3. Haz clic en **"Build Logs"** para ver errores detallados
4. Busca mensajes de error relacionados con Supabase

### Verificar Variables de Entorno
1. Ve a **Settings** → **Environment Variables**
2. Confirma que veas las 3 variables listadas
3. Asegúrate de que estén en **todos los entornos** (Production, Preview, Development)

---

## 📸 Capturas de Referencia

### Cómo debe verse la configuración:

**Environment Variables:**
```
NEXT_PUBLIC_SUPABASE_URL          | Production, Preview, Development
NEXT_PUBLIC_SUPABASE_ANON_KEY     | Production, Preview, Development
SUPABASE_SERVICE_ROLE_KEY         | Production, Preview, Development
```

---

## ⏱️ Tiempo Estimado

- ⏰ Añadir variables: **2 minutos**
- ⏰ Re-deploy: **1-2 minutos**
- ⏰ **Total: ~5 minutos**

---

¡Después de esto tu aplicación debería estar funcionando correctamente! 🎉
