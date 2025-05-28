// Selector for the container of the comment text editor (often a div with role="textbox")
const COMMENT_EDITOR_CONTAINER_SELECTOR_CONTAINS = "comments-comment-box-comment__text-editor";
// Selector for the actual contenteditable field within the container.
// LinkedIn often uses a div with class "ql-editor" or a generic contenteditable div.
// We'll try a generic one first, but ".ql-editor" might be more specific if available.
const ACTUAL_EDITABLE_FIELD_SELECTOR = "div[contenteditable='true']";
const COMMENT_SUBMIT_BUTTON_SELECTOR_CONTAINS = "comments-comment-box__submit-button";

/**
 * Attempts to post a comment on a single LinkedIn post page
 * by simulating more natural text input into the contenteditable field.
 *
 * @param {string} content - The multiline text content for the comment.
 * @returns {Promise<boolean>} - Returns true if successful, false otherwise
 */
export async function commentOnSinglePostPage(content: string): Promise<boolean> {
    return new Promise((resolve) => {
        // 1. Find the comment editor's outer container.
        const editorContainer = document.querySelector(`[class*="${COMMENT_EDITOR_CONTAINER_SELECTOR_CONTAINS}"]`);
        if (!editorContainer) {
            console.error(`Comment editor container not found using selector part: "${COMMENT_EDITOR_CONTAINER_SELECTOR_CONTAINS}". Are you on a single post page with the comment box visible?`);
            resolve(false);
            return;
        }

        // 2. Find the actual editable field within this container.
        const editableField = editorContainer.querySelector(ACTUAL_EDITABLE_FIELD_SELECTOR) as HTMLElement;
        if (!editableField) {
            console.error(`Actual editable field (e.g., div[contenteditable="true"]) not found within the container using selector: "${ACTUAL_EDITABLE_FIELD_SELECTOR}". LinkedIn's structure might have changed.`);
            resolve(false);
            return;
        }

        // 3. Focus and click the editable field to simulate activation.
        editableField.focus();
        editableField.click(); // This can be important for some editors to initialize.

        // 4. Clear any existing placeholder or content.
        editableField.innerHTML = '';

        // 5. Split content into lines and append as paragraphs.
        const lines = content.split('\n');
        lines.forEach((lineText) => {
            const p = document.createElement('p');
            if (lineText === "") {
                // For empty lines (e.g. from \n\n), create a <p><br></p>
                // This helps maintain visual spacing in many rich text editors.
                p.appendChild(document.createElement('br'));
            } else {
                p.textContent = lineText;
            }
            editableField.appendChild(p);
        });

        // After adding content, ensure the cursor is at the end.
        // This can be important for the 'input' event to be processed correctly
        // and for the UI to behave as if the user typed up to that point.
        const selection = window.getSelection();
        if (selection) {
            const range = document.createRange();
            if (editableField.lastChild) {
                range.setStartAfter(editableField.lastChild); // Place cursor after the last paragraph
            } else {
                range.selectNodeContents(editableField); // Or at the start if it became empty
            }
            range.collapse(true); // Collapse the range to its start point (which is now the end of content)
            selection.removeAllRanges(); // Clear any existing selection
            selection.addRange(range); // Add the new range
        }
        editableField.focus(); // Re-focus to ensure the selection takes effect.

        // 6. Dispatch an 'input' event on the editable field.
        // This is crucial for React/Vue/Angular SPAs to recognize the change.
        const inputEvent = new Event('input', { bubbles: true, cancelable: true });
        editableField.dispatchEvent(inputEvent);

        // 7. Wait for a short period, then find and click the submit button.
        setTimeout(() => {
            const submitButton = document.querySelector(`[class*="${COMMENT_SUBMIT_BUTTON_SELECTOR_CONTAINS}"]`) as HTMLButtonElement;
            if (!submitButton) {
                console.error(`Comment submit button not found using selector part: "${COMMENT_SUBMIT_BUTTON_SELECTOR_CONTAINS}".`);
                resolve(false);
                return;
            }

            if (submitButton.disabled) {
                console.warn("Submit button is disabled. The programmatic input might not have fully registered. Try increasing the delay or check if the input simulation needs further refinement (e.g., more specific events).");
                resolve(false);
            } else {
                console.log("Attempting to click the submit button...");
                submitButton.click();
                console.log("Comment submission click sent. Please verify on the page.");
                resolve(true);
            }
        }, 1000); // Increased delay to 1 second to give more time for UI updates. Adjust if needed.
    });
} 