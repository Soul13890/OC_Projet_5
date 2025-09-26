const Book = require('../models/Book');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

// Création d'un livre
exports.createBook = async (req, res, next) => {
  try {
    // Récupération de l'objet Book à partir du formulaire
    const bookObject = JSON.parse(req.body.book);

    // Suppression des données privées
    delete bookObject._id;
    delete bookObject._userId;

    if (!req.file) {
      return res.status(400).json({ error: 'Image manquante.' });
    }
    
    // Nommage, conversion et enregistrement de l'image
    const timestamp = Date.now();
    const originalName = req.file.originalname.replace(/\s+/g, "-");
    const fileName = `${timestamp}-${originalName}.webp`;
    const outputPath = path.join(__dirname, '..', 'images', fileName);

    await sharp(req.file.buffer)
      .webp({ quality: 30 })
      .toFile(outputPath);

    // Création de l'objet Book avec les nouvelles infos
    const book = new Book({
      ...bookObject,
      userId: req.auth.userId,
      imageUrl: `${req.protocol}://${req.get('host')}/images/${fileName}`
    });

    await book.save(); // Sauvegarde du livre dans la base de données
    res.status(201).json({ message: 'Livre enregistré avec image compressée !' });

  } catch (error) {
    console.error('Erreur createBook :', error);
    res.status(400).json({ error: 'Erreur lors de l\'enregistrement du livre.' });
  }
};

// Récupérer les infos d'un livre
exports.getOneBook = (req, res, next) => {
  // Récupération du livre à partir de son id
  Book.findOne({
    _id: req.params.id
  }).then(
    (book) => {
      res.status(200).json(book);
    }
  ).catch(
    (error) => {
      res.status(404).json({
        error: error
      });
    }
  );
};

// Modifier les infos d'un livre
exports.modifyBook = async (req, res, next) => {
  try {
    // Récupération des nouvelles infos du livre rentrées par l'utilisateur
    const bookObject = req.file
      ? JSON.parse(req.body.book)
      : req.body;

    // Suppresion des infos privées
    delete bookObject._userId;

    // Récupération des infos du livre dans la base de données
    const book = await Book.findOne({ _id: req.params.id });

    // Vérification que l'utilisateur a le droit de modifier ce livre
    if (book.userId !== req.auth.userId) {
      return res.status(401).json({ message: 'Non autorisé' });
    }

    let imageUrl = book.imageUrl;

    if (req.file) {
      // Suppression de l'ancienne image
      const oldFilename = imageUrl.split('/images/')[1];
      fs.unlink(`images/${oldFilename}`, (err) => {
        if (err) console.error('Erreur suppression ancienne image :', err);
      });

      // Enregistrement de la nouvelle image
      const timestamp = Date.now();
      const originalName = req.file.originalname.replace(/\s+/g, "-");
      const fileName = `${timestamp}-${originalName}.webp`;
      const outputPath = path.join(__dirname, '..', 'images', fileName);

      await sharp(req.file.buffer)
        .webp({ quality: 30 })
        .toFile(outputPath);

      imageUrl = `${req.protocol}://${req.get('host')}/images/${fileName}`;
    }

    // Mise à jour des infos du livre dans la base de données
    await Book.updateOne(
      { _id: req.params.id },
      { ...bookObject, imageUrl, _id: req.params.id }
    );

    res.status(200).json({ message: 'Livre modifié avec image compressée !' });

  } catch (error) {
    console.error('Erreur modifyBook :', error);
    res.status(400).json({ error });
  }
};

// Suppression d'un livre
exports.deleteBook = (req, res, next) => {
  // Récupération du livre dans la base de données
   Book.findOne({ _id: req.params.id})
       .then(book => {
          // Vérification d'autorisation de l'utilisateur
           if (book.userId != req.auth.userId) {
               res.status(401).json({message: 'Non autorisé'});
           } else {
              // Suppression de l'image
               const filename = book.imageUrl.split('/images/')[1];
               fs.unlink(`images/${filename}`, () => {
                  // Suppression du livre de la base de données
                   Book.deleteOne({_id: req.params.id})
                       .then(() => { res.status(200).json({message: 'Livre supprimé !'})})
                       .catch(error => res.status(401).json({ error }));
               });
           }
       })
       .catch( error => {
           res.status(500).json({ error });
       });
};

// Récupération de tous les livres
exports.getAllBooks = (req, res, next) => {
  Book.find().then(
    (books) => {
      res.status(200).json(books);
    }
  ).catch(
    (error) => {
      res.status(400).json({
        error: error
      });
    }
  );
};

// Récupération des trois livres les mieux notés
exports.getBestRating = (req, res, next) => {
  // Récupération de tous les livres
  Book.find()
    .sort({ averageRating: -1 }) // Tri des livres par leur note moyenne par ordre décroissant
    .limit(3) // On limite notre tableau à trois éléments
    .then((books) => {
      res.status(200).json(books);
    })
    .catch((error) => {
      res.status(400).json({ error });
    });
};

// Notation d'un livre
exports.rateBook = async (req, res) => {
  const bookId = req.params.id;
  const { userId, rating } = req.body;

  // Vérification des données reçues
  if (!userId || typeof rating !== 'number') {
    return res.status(400).json({ message: 'userId et rating sont requis.' });
  }

  if (rating < 0 || rating > 5) {
    return res.status(400).json({ message: 'La note doit être comprise entre 0 et 5.' });
  }

  try {
    // Récupération des infos du livre
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: 'Livre non trouvé.' });

    // Vérification pour savoir si l'utilisateur à déjà noté ce livre
    const alreadyRated = book.ratings.find(r => r.userId === userId);
    if (alreadyRated) {
      return res.status(403).json({ message: 'Cet utilisateur a déjà noté ce livre.' });
    }
    
    // Ajout de la note au tableau de note du livre
    book.ratings.push({ userId, grade: rating });
    
    // Calcul de la moyenne des notes du livre
    const total = book.ratings.reduce((sum, r) => sum + r.grade, 0);
    book.averageRating = total / book.ratings.length;

    // Sauvegarde du livre dans la base de données
    await book.save();

    res.status(201).json(book);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erreur serveur." });
  }
};
