import express from "express";
import cors from "cors";
import {MercadoPagoConfig, Preference} from 'mercadopago'
import fetch from "node-fetch";
import dotenv from 'dotenv';

dotenv.config()

const result = dotenv.config();

if (result.error) {
  console.log("Error al cargar el archivo .env:", result.error);
} else {
  console.log("Archivo .env cargado correctamente.");
}
const accessTokenMP = process.env.MP_TOKEN;
const publicKeyMP = process.env.MP_PUBLIC_KEY;
const urlBase = process.env.URL_BASE;
const webhookUrl = process.env.NGROK_URL;
const urlFr = process.env.URL_FR;


const client = new MercadoPagoConfig({ accessToken: accessTokenMP});

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

app.get('/status', (req, res) => {
  res.json({ status: 'ok' });
});

app.get("/",(req,res)=>{
  res.send("Server !")
});


app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);

});


app.post("/create_preference", async (req, res) => {
try{
 const body = {
    items: [{
        title: req.body.title,
        quantity: Number(req.body.quantity),
        unit_price: Number(req.body.price),
        currency_id: "ARS",
    },
  ],
    back_urls: {
        success: `${urlFr}/success`,
        failure: `${urlFr}/failure`,
        pending: `${urlFr}/pending`,
    },
    auto_return: "approved",
    notification_url:`${webhookUrl}/webhook`,
    metadata: {
      iddon: req.body.iddon,
      idacc: req.body.idacc
    },
};

const preference = new Preference(client)

  const result = await preference.create({body});


  res.json({
    id: result.id,
});
  } catch (error) {
      res.status(500).json({ error: "No se pudo crear la preferencia de pago." });
  }
});

// Ruta Webhook para recibir notificaciones de Mercado Pago
app.post('/webhook', async function (req, res) {

  if (req.body?.data?.id) {
      const paymentId = req.body.data.id;
      try{
        const response = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`,{
          method:'GET',
          headers:{
            'Authorization': `Bearer ${client.accessToken}`
          }
        });

        if(response.ok){
          const data = await response.json();
          if (data.status) {

            console.log(data.metadata.iddon);

            if (data.status === "approved") {
              console.log("✅ Pago aprobado");
              console.log(`Haciendo PATCH a: ${urlBase}/accounts/${data.metadata.idacc}/donations/${data.metadata.iddon}`);


           
              // Realizamos el PATCH a tu backend para actualizar el estado de la donación
              const updateResponse = await fetch(`${urlBase}/accounts/${data.metadata.idacc}/donations/${data.metadata.iddon}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: "approved" }) // Estado que queremos poner
              });
                console.log('updateResponse',updateResponse);
                console.log('updateResponse',updateResponse.status);
              
              if (updateResponse.ok) {
                console.log("Estado de la donación actualizado a 'approved'");
              } else {
                const errorDetails = await updateResponse.json();
                console.log("Error al actualizar el estado de la donación:", errorDetails);
              }
            
          } else if (data.status === "rejected") {
              console.log("❌ Pago rechazado");

              const updateResponse = await fetch(`${urlBase}/accounts/${data.metadata.idacc}/donations/${data.metadata.iddon}`, {
                method: 'PATCH',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({ status: "rejected" })
              });

              if (updateResponse.ok) {
                console.log("Estado de la donación actualizado a 'rejected'");
              } else {
                const errorDetails = await updateResponse.json();
                console.log("Error al actualizar el estado de la donación:", errorDetails);
              }
              } else {
                console.log("⚠️ Estado desconocido:", data.status);
            }
        } else {
            console.log("No se encontró la propiedad 'status' en la respuesta.");
        }
        }else{
          console.log('error');
        }
        res.sendStatus(200);
      }catch(error){
        console.error('Error: ', error);
        res.sendStatus(500);
      }
  } else {

  }
});
