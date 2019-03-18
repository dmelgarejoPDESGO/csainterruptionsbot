// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityTypes } = require('botbuilder');
const { DialogSet, ChoicePrompt, WaterfallDialog, DialogTurnStatus } = require('botbuilder-dialogs');

// Name for the dialog state property accessor.
const DIALOG_STATE_PROPERTY = 'dialogStateProperty';

// Name of the order-prompt dialog.
const ORDER_PROMPT = 'orderingDialog';

// Name for the choice prompt for use in the dialog.
const CHOICE_PROMPT = 'choicePrompt';

// The options on the dinner menu, including commands for the bot.
const dinnerMenu = {
    choices: ["Ensalada de Papas - $5.99", "Sandwich de Atun - $6.89", "Sopa de Almejas - $4.50",
        "Procesar orden", "Cancel", "Mas info", "Ayuda"],
    "Ensalada de Papas - $5.99": {
        description: "Ensalada de Papas",
        price: 5.99
    },
    "Sandwich de Atun - $6.89": {
        description: "Sandwich de Atun",
        price: 6.89
    },
    "Sopa de Almejas - $4.50": {
        description: "Sopa de Almejas",
        price: 4.50
    }
}

class MyBot {
    /**
     *
     * @param {ConversationState} conversationState A ConversationState object used to store the dialog state.
     */
    constructor(conversationState) {
        this.dialogStateAccessor = conversationState.createProperty(DIALOG_STATE_PROPERTY);
        this.conversationState = conversationState;
    
        this.dialogs = new DialogSet(this.dialogStateAccessor)
            .add(new ChoicePrompt(CHOICE_PROMPT))
            .add(new WaterfallDialog(ORDER_PROMPT, [
                async (step) => {
                    if (step.options && step.options.orders) {
                        // If an order cart was passed in, continue to use it.
                        step.values.orderCart = step.options;
                    } else {
                        // Otherwise, start a new cart.
                        step.values.orderCart = {
                            orders: [],
                            total: 0
                        };
                    }
                    return await step.prompt(CHOICE_PROMPT, "Que desea ordenar?", dinnerMenu.choices);
                },
                async (step) => {
                    const choice = step.result;
                    if (choice.value.match(/procesar orden/ig)) {
                        if (step.values.orderCart.orders.length > 0) {
                            // If the cart is not empty, process the order by returning the order to the parent context.
                            await step.context.sendActivity("Su orden ha sido procesada.");
                            return await step.endDialog(step.values.orderCart);
                        } else {
                            // Otherwise, prompt again.
                            await step.context.sendActivity("Orden de pedido vacía. Por favor agregue elementos a la orden.");
                            return await step.replaceDialog(ORDER_PROMPT);
                        }
                    } else if (choice.value.match(/cancel/ig)) {
                        // Cancel the order, and return "cancel" to the parent context.
                        await step.context.sendActivity("Su orden ha sido cancelada.");
                        return await step.endDialog("cancelled");
                    } else if (choice.value.match(/mas info/ig)) {
                        // Provide more information, and then continue the ordering process.
                        var msg = "Mas info: <br/>Ensalada de Papas: contiene 330 calorías por porción. <br/>"
                            + "Sandwich de Atún: contiene 700 calorías por porción. <br/>"
                            + "Sopa de Almejas: contiene 650 calorías por porción."
                        await step.context.sendActivity(msg);
                        return await step.replaceDialog(ORDER_PROMPT, step.values.orderCart);
                    } else if (choice.value.match(/ayuda/ig)) {
                        // Provide help information, and then continue the ordering process.
                        var msg = `Ayuda: <br/>`
                            + `Para realizar una orden, agregue items al pedido y luego seleccione `
                            + `la opción "Procesar orden" para terminar.`
                        await step.context.sendActivity(msg);
                        return await step.replaceDialog(ORDER_PROMPT, step.values.orderCart);
                    } else {
                        // The user has chosen a food item from the menu. Add the item to cart.
                        var item = dinnerMenu[choice.value];
                        step.values.orderCart.orders.push(item.description);
                        step.values.orderCart.total += item.price;
    
                        await step.context.sendActivity(`Agregada ${item.description} al pedido. <br/>`
                            + `Total: $${step.values.orderCart.total}`);
    
                        // Continue the ordering process.
                        return await step.replaceDialog(ORDER_PROMPT, step.values.orderCart);
                    }
                }
            ]));
    }

    /**
     *
     * @param {TurnContext} on turn context object.
     */
    async onTurn(turnContext) {
        if (turnContext.activity.type === ActivityTypes.Message) {
            let dc = await this.dialogs.createContext(turnContext);
            let dialogTurnResult = await dc.continueDialog();
            if (dialogTurnResult.status === DialogTurnStatus.complete) {
                // The dialog completed this turn.
                const result = dialogTurnResult.result;
                if (!result || result === "cancelled") {
                    await turnContext.sendActivity('Su orden ha sido cancelada.');
                } else {
                    await turnContext.sendActivity(`El total de su orden es de $${result.total}`);
                }
            } else if (!turnContext.responded) {
                // No dialog was active.
                await turnContext.sendActivity("Listo para tomar su orden...");
                await dc.cancelAllDialogs();
                await dc.beginDialog(ORDER_PROMPT);
            } else {
                // The dialog is active.
            }
        } else {
            //await turnContext.sendActivity(`[${turnContext.activity.type} event detected]`);
        }
        // Save state changes
        await this.conversationState.saveChanges(turnContext);
    }
}

module.exports.MyBot = MyBot;
