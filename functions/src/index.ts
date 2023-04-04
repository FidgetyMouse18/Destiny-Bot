const functions = require("firebase-functions");
const admin = require("firebase-admin");
const axios = require('axios').default;
import { parse } from "node-html-parser";
import { EmbedBuilder, WebhookClient } from "discord.js";

admin.initializeApp();

const webhookDoc = admin.firestore().doc('webhooks/destiny')

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

exports.scheduledFunctionCrontab = functions
.region('australia-southeast1')
.runWith({ timeoutSeconds: 60 })
.pubsub
  .schedule("30 3 * * *")
  .timeZone("Australia/Brisbane")
  .onRun((context: any) => {
    console.log("Fetching Lost Sector");

    axios.get("https://todayindestiny.com/").then((res:any) => {
      let lostSector = "Not Found";
      let detailString = "";
      let detailJSON = {
        location: "unknown",
        champions: "unknown",
        threat: "unknown",
        shields: "unknown",
        modifiers: "unknown",
        exotic: "unknown",
      };

      if (res.status !== 200) {
        console.log("Not Ok");
        return;
      }
      let text:string = res.data
        const root = parse(text);
        let t = root.querySelectorAll(".eventCardContainer");
        t.forEach((e) => {
          if (
            e
              .querySelector(
                "div.eventCardHeaderContainer > div.eventCardHeaderText > p.eventCardHeaderSet"
              )
              ?.text.includes("Lost Sector")
          ) {
            let tempLostSector = e.querySelector(
              "div.eventCardHeaderContainer > div.eventCardHeaderText > p.eventCardHeaderName"
            );
            if (!tempLostSector) {
              return;
            }
            let tempLocation = e.querySelector(
              "div.eventCardContentContainer > div.eventCardDescriptionContainer > div.eventCardDescription"
            );
            if (!tempLocation) {
              return;
            }

            let t1 = e.id.split("_");

            detailJSON.exotic = t1[t1.length - 1];

            lostSector = tempLostSector.text;
            detailString = tempLocation.text;
            return;
          }
        });
        let details = detailString
          .replace(/[^0-9a-z-A-Z,:\n ]/g, "")
          .replace(/ +/, " ")
          .split("\n")
          .filter((e) => e)
          .map((e) => {
            if (e.includes(": ")) {
              return e.split(": ")[1].replace(/\s+/g, " ").trim();
            } else {
              return e;
            }
          });

        detailJSON.location = details[0];
        detailJSON.champions = details[2];
        detailJSON.threat = details[3];
        detailJSON.shields = details[4];
        detailJSON.modifiers = details[5];

        console.log(lostSector);
        console.log(detailJSON);

        const embed = new EmbedBuilder()
          .setTitle("Legend Lost Sector")
          .setColor(0x00ff33)
          .setDescription(lostSector)
          .addFields([
            {
              name: `Destination`,
              value: detailJSON.location,
              inline: true,
            },
            {
              name: `Champions`,
              value: detailJSON.champions,
              inline: true,
            },
            {
              name: `Threat`,
              value: detailJSON.threat,
              inline: true,
            },
            {
              name: `Shields`,
              value: detailJSON.shields,
              inline: true,
            },
            {
              name: `Modifiers`,
              value: detailJSON.modifiers,
              inline: true,
            },
            {
              name: `Exotic`,
              value: capitalizeFirstLetter(detailJSON.exotic),
              inline: true,
            },
          ]);
        webhookDoc.get().then((snapshot:any) => {
          snapshot.data().webhooks.forEach((url:string) => {
            const webhookClient = new WebhookClient({
              url: url,
            });
            webhookClient.send({
              embeds: [embed],
            });
          });
        })
        
      
    });

    return null;
  });
