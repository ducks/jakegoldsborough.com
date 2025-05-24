+++
title = "Deploying a Zola static site to a custom domain with Github Actions"
date = "2025-05-24"
+++

As I've been searching for a new gig, I've gotten the urge to write a bit more
about some of the stuff I'm up to to help make myself stand out. I really like
using the fewest tools as needed so I knew a static site generator was what I
wanted. I also like to use Rust based tools when possible.

Searching for Rust static site generators lead me to
[Zola](https://www.getzola.org/).

Some of the top advertised features are no dependencies, blazingly fast,
and easy to use. Those sound great to me.

### Set up Zola site

While this isn't a few blown Zola tutorial, I did want to include a few things.

After installing Zola, you can simply run `zola init myblog`.

You'll be asked a few questions and a base site will be setup for you.

```
├── config.toml
├── content
├── sass
├── static
├── templates
└── themes
```

Without going too deep, your CommonMark pages will go in `content`, Tera/HTML
templates in `templates`, and any css/js/images or other static content will go
in `static`.

SASS is enabled by default but can be disabled. I am not currently using SASS
personally.

Running `zola build` will build the site and output it a directory called `public`.

Here is a link to a complete overview:

[https://www.getzola.org/documentation/getting-started/overview/](https://www.getzola.org/documentation/getting-started/overview/)

### Push to Github & Create Github Actions workflow

After getting your content written, site styled, and ready for deployment, it's time to
push to Github. Create a repo and push it to a `main` branch (exclude the `public`
directory).

Next, we will setup the actual workflow to take our input files, setup zola,
build the site, and commit it to the correct branch.

Create a file at `.github/workflows/deploy.yml` and insert this:

```
name: Deploy Zola to GitHub Pages

on:
  push:
    branches: [main]

jobs:
  build-deploy:
    runs-on: ubuntu-latest

    steps:
    - name: Check out source
      uses: actions/checkout@v4

    - name: Install Zola
      run: |
        curl -L https://github.com/getzola/zola/releases/download/v0.20.0/zola-v0.20.0-x86_64-unknown-linux-gnu.tar.gz -o zola.tar.gz
        tar -xzf zola.tar.gz
        sudo mv zola /usr/local/bin/

    - name: Build site
      run: zola build

    - name: Deploy to GitHub Pages
      uses: peaceiris/actions-gh-pages@v3
      with:
        github_token: ${{ secrets.GITHUB_TOKEN }}
        publish_dir: ./public
        publish_branch: gh-pages
        force_orphan: true
```

This setups up a workflow that:
- watches for pushes to main branch
- checks out the zola source and installs it
- builds your site using zola build
- uses github pages plugin to push `public` output dir to a `gh-pages` branch

You will also need to go to your repos settings and look for the actions section
to enable write permissions.

Push this up and watch the build by going to your repo and clicking the "Actions"
tab. You will see a workflow that you can click into and see build and deploy
jobs.

If everything goes well, you can now  visit your site by filling in your values:

https://${username}.github.io/${repo}

### Add Custom Domain (optional)

After you have the initial workflow working, you will need to configure some
Github settings for a custom domain.

First, run `echo "yourdomain.com" > static/CNAME` and commit this file.
Next, go to your Github repo's "Pages" setting and add the domain name.

### Configure DNS (optional)

If using a custom domain, you will also need to setup DNS. Go to your domain
settings and add 4 A records for Github pages:

```
A	@	185.199.108.153
A	@	185.199.109.153
A	@	185.199.110.153
A	@	185.199.111.153
```

Setup any subdirectories you might want.

You may need to give this step some extra time to update before you can
see your new site at your custom URL. Other times it's nearly instant so your
results may vary.

### Profit

That's basically it for a basic setup. You should now have a static site
setup at a custom domain that gets automatically built by just pushing a branch.

While simple, this is a complete setup that let's you create and deploy content
to your own URL with ease.
