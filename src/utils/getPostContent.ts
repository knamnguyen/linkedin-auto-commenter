export function getPostContent(): string {
    // Select the container with the class 'fie-impression-container'
    const container = document.querySelector('.fie-impression-container');

    // Function to recursively extract text from all descendants
    function extractText(node: Node): string {
        let text = '';
        // Loop through all child nodes
        node.childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) { 
                // If it's a text node, add its trimmed text
                text += child.textContent?.trim() + ' ';
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                // If it's an element node, recurse
                text += extractText(child);
            }
        });
        return text;
    }

    if (container) {
        // Extract and log all text content, trimmed of extra whitespace
        const allText = extractText(container).replace(/\s+/g, ' ').trim();
        console.log(allText);
        return allText;
    } else {
        console.log('No element with class "fie-impression-container" found.');
        return '';
    }
} 