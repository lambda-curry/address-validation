#!/bin/bash

# Check if the file exists
if [ ! -f "US.txt" ]; then
    echo "Error: US.txt file not found in the current directory"
    exit 1
fi

# Upload the file to R2
echo "Uploading US.txt to R2 bucket 'postal-code-data'..."
wrangler r2 object put postal-code-data/US.txt --file=US.txt

# Check if the upload was successful
if [ $? -eq 0 ]; then
    echo "File uploaded successfully!"
else
    echo "Error uploading file"
    exit 1
fi 