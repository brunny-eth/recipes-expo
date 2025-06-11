document.addEventListener('DOMContentLoaded', function () {
    const tabHome = document.getElementById('tab-home');
    const tabWhatIsThis = document.getElementById('tab-whatisthis');
    const linkToHome = document.getElementById('link-to-home'); // Link from 'What is this?' back to Home

    const contentHome = document.getElementById('content-home');
    const contentWhatIsThis = document.getElementById('content-whatisthis');

    const recipeForm = document.getElementById('recipe-form');
    const recipeUrlInput = document.getElementById('recipe-url');
    const qrCodeContainer = document.getElementById('qr-code-container');
    const qrCodeImg = document.getElementById('qr-code-img');
    const qrDataMock = document.getElementById('qr-data-mock');

    function showTab(tabName) {
        // Hide all content
        contentHome.classList.remove('active');
        contentWhatIsThis.classList.remove('active');

        // Deactivate all tabs
        tabHome.classList.remove('active');
        tabWhatIsThis.classList.remove('active');

        // Activate selected tab and content
        if (tabName === 'home') {
            contentHome.classList.add('active');
            tabHome.classList.add('active');
        } else if (tabName === 'whatisthis') {
            contentWhatIsThis.classList.add('active');
            tabWhatIsThis.classList.add('active');
        }
        // Scroll to top when tab changes for better UX on mobile
        window.scrollTo(0, 0);
    }

    tabHome.addEventListener('click', function (event) {
        event.preventDefault();
        showTab('home');
    });

    tabWhatIsThis.addEventListener('click', function (event) {
        event.preventDefault();
        showTab('whatisthis');
    });
    
    // Listener for the link within 'What is this?' page to go back to home tab
    if(linkToHome){
        linkToHome.addEventListener('click', function(event){
            event.preventDefault();
            showTab('home');
        });
    }

    recipeForm.addEventListener('submit', function (event) {
        event.preventDefault();
        const url = recipeUrlInput.value.trim();
        if (url) {
            // Mock QR Code Generation
            // In a real scenario, you'd call a QR code generation library or API
            // For now, we'll use a placeholder image service like placehold.co for a visual mock
            // and display the URL that would be encoded.
            const placeholderQrUrl = `https://placehold.co/200x200/007bff/FFF/png?text=QR+for&font=roboto`;
            qrCodeImg.src = placeholderQrUrl;
            qrCodeImg.alt = `QR Code for ${url}`;
            qrDataMock.textContent = `(Mock QR: would link to Meez app with recipe: ${url})`;
            qrCodeContainer.style.display = 'block';
            
            // Optionally, scroll to the QR code
            qrCodeContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });

        } else {
            // Simple validation feedback
            alert('Please paste a recipe URL or recipe text.');
            qrCodeContainer.style.display = 'none';
        }
    });

    // Initialize with the home tab active
    showTab('home');
}); 