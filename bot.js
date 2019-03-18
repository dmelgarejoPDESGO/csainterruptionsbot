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
    choices: ["Potato Salad - $5.99", "Tuna Sandwich - $6.89", "Clam Chowder - $4.50",
        "Process order", "Cancel", "More info", "Help"],
    "Potato Salad - $5.99": {
        description: "Potato Salad",
        price: 5.99
    },
    "Tuna Sandwich - $6.89": {
        description: "Tuna Sandwich",
        price: 6.89
    },
    "Clam Chowder - $4.50": {
        description: "Clam Chowder",
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
                    return await step.prompt(CHOICE_PROMPT, "What would you like?", dinnerMenu.choices);
                },
                async (step) => {
                    const choice = step.result;
                    if (choice.value.match(/process order/ig)) {
                        if (step.values.orderCart.orders.length > 0) {
                            // If the cart is not empty, process the order by returning the order to the parent context.
                            await step.context.sendActivity("Your order has been processed.");
                            return await step.endDialog(step.values.orderCart);
                        } else {
                            // Otherwise, prompt again.
                            await step.context.sendActivity("Your cart was empty. Please add at least one item to the cart.");
                            return await step.replaceDialog(ORDER_PROMPT);
                        }
                    } else if (choice.value.match(/cancel/ig)) {
                        // Cancel the order, and return "cancel" to the parent context.
                        await step.context.sendActivity("Your order has been canceled.");
                        return await step.endDialog("cancelled");
                    } else if (choice.value.match(/more info/ig)) {
                        // Provide more information, and then continue the ordering process.
                        var msg = "More info: <br/>Potato Salad: contains 330 calories per serving. <br/>"
                            + "Tuna Sandwich: contains 700 calories per serving. <br/>"
                            + "Clam Chowder: contains 650 calories per serving."
                        await step.context.sendActivity(msg);
                        return await step.replaceDialog(ORDER_PROMPT, step.values.orderCart);
                    } else if (choice.value.match(/help/ig)) {
                        // Provide help information, and then continue the ordering process.
                        var msg = `Help: <br/>`
                            + `To make an order, add as many items to your cart as you like then choose `
                            + `the "Process order" option to check out.`
                        await step.context.sendActivity(msg);
                        return await step.replaceDialog(ORDER_PROMPT, step.values.orderCart);
                    } else {
                        // The user has chosen a food item from the menu. Add the item to cart.
                        var item = dinnerMenu[choice.value];
                        step.values.orderCart.orders.push(item.description);
                        step.values.orderCart.total += item.price;
    
                        await step.context.sendActivity(`Added ${item.description} to your cart. <br/>`
                            + `Current total: $${step.values.orderCart.total}`);
    
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
                    await turnContext.sendActivity('You cancelled your order.');
                } else {
                    await turnContext.sendActivity(`Your order came to $${result.total}`);
                }
            } else if (!turnContext.responded) {
                // No dialog was active.
                await turnContext.sendActivity("Let's order dinner...");
                await dc.cancelAllDialogs();
                await dc.beginDialog(ORDER_PROMPT);
            } else {
                // The dialog is active.
            }
        } else {
            await turnContext.sendActivity(`[${turnContext.activity.type} event detected]`);
        }
        // Save state changes
        await this.conversationState.saveChanges(turnContext);
    }
}

module.exports.MyBot = MyBot;
