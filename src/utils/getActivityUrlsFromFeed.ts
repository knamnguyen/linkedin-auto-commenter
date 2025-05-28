const baseUrl = "https://www.linkedin.com/feed/update/";
const urnRegex = /urn:li:activity:\d+/g;

export function extractAllLinkedInActivityUrnsFromHtml(): string[] {
    // Use a Set to store constructed post URLs, ensuring each URL is unique.
    const postUrls = new Set<string>();

    // Get the entire HTML content of the document.
    // This allows searching for URNs anywhere on the page.
    const htmlContent = document.documentElement.innerHTML;

    // Regular expression to find all occurrences of 'urn:li:activity:' followed by one or more digits.
    // The 'g' flag ensures it finds all matches, not just the first.
    let match;

    // Loop through all matches found in the HTML content.
    while ((match = urnRegex.exec(htmlContent)) !== null) {
        // match[0] contains the full matched URN string (e.g., "urn:li:activity:7328787690454220801").
        const activityUrn = match[0];
        // Construct the full post URL.
        const postUrl = baseUrl + activityUrn;
        // Add the constructed URL to our Set (duplicates are automatically handled).
        postUrls.add(postUrl);
    }

    if (postUrls.size === 0) {
        console.log("No LinkedIn post URLs derived from activity URNs found in the entire HTML. Things to check:");
        console.log("- Ensure you are on a LinkedIn page where such URNs are present (e.g., your feed).");
        console.log("- Make sure content is loaded on the page (scroll down if necessary).");
        console.log("- The specific URN pattern 'urn:li:activity:...' might not be present as plain text in the HTML in a way that's findable by this script.");
        return [];
    }

    // Convert the Set of URLs to an array.
    const urlsArray = Array.from(postUrls);

    console.log(`Found ${urlsArray.length} unique LinkedIn Post URLs from activity URNs in the HTML:`);
    urlsArray.forEach(url => {
        // Most browser consoles will automatically make these logged strings clickable.
        console.log(url);
    });

    // The function returns the array of URLs if you need to use it programmatically in the console.
    return urlsArray;
} 